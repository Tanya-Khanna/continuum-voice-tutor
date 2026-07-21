import { randomUUID } from "node:crypto";
import type { LearningRepository } from "../domain/learner.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";
import {
  InboundSmsSchema,
  SmsReceiptSchema,
  parseSmsCommand,
  type SmsReceipt,
} from "../domain/sms-control.js";
import { parseHomeworkReply } from "../domain/homework.js";
import type { GuardianAccessService } from "../guardian/guardian-access-service.js";
import type { HomeworkService } from "./homework-service.js";
import type { SmsReminderService } from "./sms-reminder-service.js";

const HELP_TEXT =
  "Commands: STOP, PROGRESS, MEMORY, DELETE, HELP. Practice: HW CODE 1-4.";

export class OpenTopicSmsService {
  readonly #repository: LearningRepository;
  readonly #guardianAccess: GuardianAccessService;
  readonly #homeworkService: HomeworkService | undefined;
  readonly #reminderService: SmsReminderService | undefined;
  readonly #clock: () => Date;
  readonly #makeId: () => string;

  constructor(options: {
    repository: LearningRepository;
    guardianAccess: GuardianAccessService;
    homeworkService?: HomeworkService;
    reminderService?: SmsReminderService;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    this.#repository = options.repository;
    this.#guardianAccess = options.guardianAccess;
    this.#homeworkService = options.homeworkService;
    this.#reminderService = options.reminderService;
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
          action: "practice",
          responseText: submitted.responseText,
          createdAt: now,
        });
      } catch {
        return this.#complete({
          messageSid: payload.MessageSid,
          learnerId: null,
          action: "practice_unauthorized",
          responseText: "Practice code not recognized for this phone.",
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
        action: "bounded_help",
        responseText: HELP_TEXT,
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

    let responseText: string;
    let action: string = command.action;
    if (command.action === "stop") {
      this.#repository.saveGuardianAuthorization({
        ...authorization,
        proactiveCallsAllowed: false,
        updatedAt: now,
      });
      const legacyPlan = this.#repository.findStudyPlan(learner.id);
      if (legacyPlan) {
        this.#repository.saveStudyPlan({
          ...legacyPlan,
          status: "paused",
          nextScheduledCall: null,
          claimToken: null,
          claimExpiresAt: null,
          updatedAt: now,
        });
      }
      this.#reminderService?.cancelAll(learner.id);
      responseText =
        "Future proactive messages and calls stopped. Learning memory is kept unless you delete it.";
    } else if (command.action === "progress") {
      const lessons = this.#repository
        .listRecentLessons(100)
        .filter((session) => session.learnerId === learner.id);
      const latest = lessons[0];
      responseText = latest
        ? `${learner.name}: ${lessons.length} learning session${lessons.length === 1 ? "" : "s"}. Current topic: ${latest.concept}. Understanding: ${latest.masteryStatus.replace("_", " ")}.`
        : `${learner.name} has not started a learning topic yet.`;
    } else if (command.action === "memory") {
      const profile = this.#repository.findEducationProfile(learner.id);
      const latest = this.#repository
        .listRecentLessons(100)
        .find((session) => session.learnerId === learner.id);
      responseText = `Memory: language${latest ? `, topic ${latest.concept}, obstacle, helpful method, and exact next step` : ""}${profile?.consentedFields.length ? `, plus ${profile.consentedFields.length} approved preference groups` : ""}. No raw call recording.`;
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
          responseText = "Learning profile deleted and future contact cancelled.";
          action = "deleted";
        }
      }
    } else {
      action = "outbound_calls_disabled";
      responseText =
        "Continuum does not schedule repeated tutoring calls. Call when you want to learn; reply STOP to end proactive messages.";
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
