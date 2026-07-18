import { randomUUID } from "node:crypto";
import type { LearningRepository } from "../domain/learner.js";
import {
  InboundSmsSchema,
  SmsReceiptSchema,
  parseSmsCommand,
  type SmsReceipt,
} from "../domain/sms-control.js";
import { StudyPlanSchema, type StudyPlan } from "../domain/study-plan.js";
import type { GuardianAccessService } from "../guardian/guardian-access-service.js";
import { nextScheduledCall } from "../scheduling/schedule-time.js";
import { protectCallbackDestination } from "../telephony/missed-call-callback.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";
import { parseHomeworkReply } from "../domain/homework.js";
import type { HomeworkService } from "./homework-service.js";

const HELP_TEXT =
  "Commands: START, STOP, PAUSE, RESUME, TIME, DAYS, PROGRESS, MEMORY, DELETE, HELP.";

export class SmsControlService {
  readonly #repository: LearningRepository;
  readonly #guardianAccess: GuardianAccessService;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #defaultSubject: string;
  readonly #timeZone: string;
  readonly #callbackSecret: string;
  readonly #homeworkService: HomeworkService | undefined;

  constructor(options: {
    repository: LearningRepository;
    guardianAccess: GuardianAccessService;
    defaultSubject: string;
    timeZone: string;
    callbackSecret: string;
    homeworkService?: HomeworkService;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    this.#repository = options.repository;
    this.#guardianAccess = options.guardianAccess;
    this.#defaultSubject = options.defaultSubject;
    this.#timeZone = options.timeZone;
    this.#callbackSecret = options.callbackSecret;
    this.#homeworkService = options.homeworkService;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
  }

  handle(unparsedPayload: unknown): SmsReceipt {
    const payload = InboundSmsSchema.parse(unparsedPayload);
    const nowDate = this.#clock();
    const now = nowDate.toISOString();
    if (!this.#repository.reserveSmsMessage(payload.MessageSid, now)) {
      return (
        this.#repository.findSmsReceipt(payload.MessageSid) ??
        SmsReceiptSchema.parse({
          messageSid: payload.MessageSid,
          learnerId: null,
          action: "duplicate",
          responseText: "This message was already processed.",
          createdAt: now,
        })
      );
    }

    const homeworkReply = parseHomeworkReply(payload.Body);
    if (homeworkReply && this.#homeworkService) {
      try {
        const submitted = this.#homeworkService.submit({
          reply: homeworkReply,
          sourcePhoneNumber: payload.From,
        });
        return this.#complete({
          messageSid: payload.MessageSid,
          learnerId: submitted.assignment.learnerId,
          action: "homework",
          responseText: submitted.responseText,
          createdAt: now,
        });
      } catch {
        return this.#complete({
          messageSid: payload.MessageSid,
          learnerId: null,
          action: "homework_unauthorized",
          responseText: "Homework code not recognized for this phone.",
          createdAt: now,
        });
      }
    }

    let command;
    try {
      command = parseSmsCommand(payload.Body);
    } catch {
      return this.#complete({
        messageSid: payload.MessageSid,
        learnerId: null,
        action: "invalid",
        responseText: `${HELP_TEXT} Example: PROGRESS 123456`,
        createdAt: now,
      });
    }
    if (command.action === "help") {
      return this.#complete({
        messageSid: payload.MessageSid,
        learnerId: null,
        action: "help",
        responseText: HELP_TEXT,
        createdAt: now,
      });
    }
    const authorization = this.#guardianAccess.verify({
      code: command.code,
      guardianPhoneNumber: payload.From,
    });
    if (!authorization?.smsAllowed) {
      return this.#complete({
        messageSid: payload.MessageSid,
        learnerId: null,
        action: "unauthorized",
        responseText: "Code not recognized for this phone. Reply HELP for options.",
        createdAt: now,
      });
    }
    const learner = this.#repository.findLearner(authorization.learnerId);
    if (!learner) {
      return this.#complete({
        messageSid: payload.MessageSid,
        learnerId: null,
        action: "missing_profile",
        responseText: "That learning profile is no longer available.",
        createdAt: now,
      });
    }

    let plan = this.#repository.findStudyPlan(learner.id);
    const ensurePlan = (): StudyPlan => {
      if (plan) return plan;
      plan = StudyPlanSchema.parse({
        id: this.#makeId(),
        learnerId: learner.id,
        goal: "Continue steady learning and review.",
        subjects: [this.#defaultSubject],
        currentLevels: {},
        reviewQueue: [],
        nextConcepts: [learner.currentConcept],
        preferredWeekdays: ["MON", "WED", "FRI"],
        localStartTime: "19:00",
        deploymentTimezone: this.#timeZone,
        durationMinutes: 5,
        guardianConsent: true,
        encryptedContactNumber: protectCallbackDestination(
          payload.From,
          this.#callbackSecret,
        ),
        status: "paused",
        nextScheduledCall: null,
        missedLessons: 0,
        lastCompletion: null,
        claimToken: null,
        claimExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return plan;
    };
    const savePlan = (next: StudyPlan): void => {
      plan = StudyPlanSchema.parse(next);
      this.#repository.saveStudyPlan(plan);
    };
    let responseText: string;
    let action: string = command.action;

    if (command.action === "start" || command.action === "resume") {
      const current = ensurePlan();
      this.#repository.saveGuardianAuthorization({
        ...authorization,
        proactiveCallsAllowed: true,
        updatedAt: now,
      });
      savePlan({
        ...current,
        guardianConsent: true,
        status: "active",
        nextScheduledCall: nextScheduledCall({
          now: nowDate,
          weekdays: current.preferredWeekdays,
          localStartTime: current.localStartTime,
          timeZone: current.deploymentTimezone,
        }),
        updatedAt: now,
      });
      responseText = `Calls active: ${plan!.preferredWeekdays.join(" ")} at ${plan!.localStartTime}. Reply STOP ${command.code} anytime.`;
    } else if (command.action === "stop" || command.action === "pause") {
      const current = ensurePlan();
      savePlan({
        ...current,
        status: "paused",
        nextScheduledCall: null,
        updatedAt: now,
      });
      if (command.action === "stop") {
        this.#repository.saveGuardianAuthorization({
          ...authorization,
          proactiveCallsAllowed: false,
          updatedAt: now,
        });
      }
      responseText = command.action === "stop"
        ? "Future calls stopped. Learning history is kept unless you delete it."
        : "Calls paused. Reply RESUME with the guardian code when ready.";
    } else if (command.action === "time") {
      const current = ensurePlan();
      savePlan({
        ...current,
        localStartTime: command.time,
        nextScheduledCall:
          current.status === "active"
            ? nextScheduledCall({
                now: nowDate,
                weekdays: current.preferredWeekdays,
                localStartTime: command.time,
                timeZone: current.deploymentTimezone,
              })
            : null,
        updatedAt: now,
      });
      responseText = `Lesson time set to ${command.time}.`;
    } else if (command.action === "days") {
      const current = ensurePlan();
      const uniqueDays = [...new Set(command.days)];
      savePlan({
        ...current,
        preferredWeekdays: uniqueDays,
        nextScheduledCall:
          current.status === "active"
            ? nextScheduledCall({
                now: nowDate,
                weekdays: uniqueDays,
                localStartTime: current.localStartTime,
                timeZone: current.deploymentTimezone,
              })
            : null,
        updatedAt: now,
      });
      responseText = `Lesson days set to ${uniqueDays.join(" ")}.`;
    } else if (command.action === "progress") {
      const lessons = this.#repository
        .listRecentLessons(100)
        .filter((session) => session.learnerId === learner.id);
      const latest = lessons[0];
      responseText = latest
        ? `${learner.name}: ${lessons.length} lesson${lessons.length === 1 ? "" : "s"}. ${latest.concept}: ${latest.masteryStatus.replace("_", " ")}.`
        : `${learner.name} has not completed a lesson yet.`;
    } else if (command.action === "memory") {
      const profile = this.#repository.findEducationProfile(learner.id);
      const evidence = this.#repository.listLearningEvidence(learner.id, 20);
      responseText = `Memory: language, ${evidence.length} learning checks${profile?.consentedFields.length ? `, and ${profile.consentedFields.length} approved preference groups` : ""}. No raw call recording.`;
    } else if (command.action === "delete") {
      if (!command.confirm) {
        responseText = `Deletion requested. Reply DELETE ${command.code} CONFIRM within 10 minutes.`;
        action = "delete_requested";
      } else {
        const since = new Date(nowDate.getTime() - 10 * 60_000).toISOString();
        if (!this.#repository.hasRecentDeletionRequest(learner.id, since)) {
          responseText = `First reply DELETE ${command.code}. Then confirm within 10 minutes.`;
          action = "delete_confirmation_missing";
        } else {
          this.#repository.deleteLearnerData(learner.id);
          responseText = "Learning profile deleted and future calls cancelled.";
          action = "deleted";
        }
      }
    } else {
      responseText = HELP_TEXT;
    }

    return this.#complete({
      messageSid: payload.MessageSid,
      learnerId: action === "deleted" ? null : learner.id,
      action,
      responseText,
      createdAt: now,
    });
  }

  #complete(unparsedReceipt: SmsReceipt): SmsReceipt {
    const receipt = SmsReceiptSchema.parse(unparsedReceipt);
    this.#repository.completeSmsMessage(receipt);
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name: "sms_command_processed",
        learnerId: receipt.learnerId,
        sessionId: null,
        channel: "sms",
        accessMode: "unknown",
        numericValue: null,
        synthetic: false,
        createdAt: receipt.createdAt,
      }),
    );
    return receipt;
  }
}
