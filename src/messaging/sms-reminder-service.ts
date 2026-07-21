import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPhoneNumber } from "../domain/identity.js";
import type { LearningRepository } from "../domain/learner.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";
import {
  SmsReminderSchema,
  type SmsReminder,
} from "../domain/sms-reminder.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";
import {
  protectCallbackDestination,
  revealCallbackDestination,
} from "../telephony/missed-call-callback.js";
import { smsSegmentInfo } from "../domain/sms-control.js";

const E164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/u);

function localHour(date: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(value ?? 0) % 24;
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  return start > end
    ? hour >= start || hour < end
    : hour >= start && hour < end;
}

function nextAllowedInstant(options: {
  now: Date;
  timeZone: string;
  quietStartHour: number;
  quietEndHour: number;
}): Date {
  let candidate = new Date(options.now.getTime() + 15 * 60_000);
  for (let index = 0; index < 96; index += 1) {
    if (
      !isQuietHour(
        localHour(candidate, options.timeZone),
        options.quietStartHour,
        options.quietEndHour,
      )
    ) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + 15 * 60_000);
  }
  return candidate;
}

function oneSegmentReminder(topic: string): { topic: string; message: string } {
  let fittedTopic = topic;
  while (fittedTopic.length > 0) {
    const message = `Review: ${fittedTopic}. Call Continuum. STOP <code>.`;
    if (smsSegmentInfo(message).segments === 1) {
      return { topic: fittedTopic, message };
    }
    fittedTopic = fittedTopic.slice(0, -1).trimEnd();
  }
  throw new Error("The reminder topic cannot fit in one SMS segment.");
}

function oneSegmentCallbackNudge(topic: string): {
  topic: string;
  message: string;
} {
  let fittedTopic = topic;
  while (fittedTopic.length > 0) {
    const message = `Continue: ${fittedTopic}. Call Continuum. STOP <code>.`;
    if (smsSegmentInfo(message).segments === 1) {
      return { topic: fittedTopic, message };
    }
    fittedTopic = fittedTopic.slice(0, -1).trimEnd();
  }
  throw new Error("The callback reminder topic cannot fit in one SMS segment.");
}

export class SmsReminderService {
  readonly #repository: LearningRepository;
  readonly #phoneHashSecret: string;
  readonly #encryptionSecret: string;
  readonly #timeZone: string;
  readonly #quietStartHour: number;
  readonly #quietEndHour: number;
  readonly #clock: () => Date;
  readonly #makeId: () => string;

  constructor(options: {
    repository: LearningRepository;
    phoneHashSecret: string;
    encryptionSecret: string;
    timeZone: string;
    quietStartHour: number;
    quietEndHour: number;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    this.#repository = options.repository;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#encryptionSecret = options.encryptionSecret;
    this.#timeZone = options.timeZone;
    this.#quietStartHour = options.quietStartHour;
    this.#quietEndHour = options.quietEndHour;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
  }

  scheduleExamReview(options: {
    learnerId: string;
    recipientPhoneNumber: string;
    topic: string;
    dueAt: string;
    examAt: string;
    consentConfirmed: boolean;
  }, internal: { kind: "exam_review" | "callback_nudge" } = {
    kind: "exam_review",
  }): SmsReminder {
    if (!options.consentConfirmed) {
      throw new Error("An SMS reminder requires explicit consent.");
    }
    const learner = this.#repository.findLearner(options.learnerId);
    if (!learner) throw new Error(`Unknown learner ${options.learnerId}.`);
    const phoneNumber = E164Schema.parse(options.recipientPhoneNumber);
    const recipientPhoneHash = hashPhoneNumber(
      phoneNumber,
      this.#phoneHashSecret,
    );
    const authorization = this.#repository.findGuardianAuthorization(
      options.learnerId,
    );
    if (
      !authorization?.smsAllowed ||
      authorization.guardianPhoneHash !== recipientPhoneHash
    ) {
      throw new Error(
        "The learner does not have SMS authorization for this phone.",
      );
    }
    const nowDate = this.#clock();
    const dueAt = new Date(options.dueAt);
    const examAt = new Date(options.examAt);
    if (
      Number.isNaN(dueAt.getTime()) ||
      Number.isNaN(examAt.getTime()) ||
      dueAt <= nowDate ||
      dueAt >= examAt ||
      examAt.getTime() - nowDate.getTime() > 366 * 24 * 60 * 60_000
    ) {
      throw new Error(
        "The reminder must be in the future, before it expires, and within one year.",
      );
    }
    const topic = redactPotentialPii(options.topic)
      .replace(/[\r\n]+/gu, " ")
      .trim()
      .slice(0, 72);
    if (!topic) throw new Error("A reminder topic is required.");
    const fitted =
      internal.kind === "callback_nudge"
        ? oneSegmentCallbackNudge(topic)
        : oneSegmentReminder(topic);
    const existing = this.#repository
      .listSmsReminders(options.learnerId)
      .find(
        (reminder) =>
          reminder.kind === internal.kind &&
          reminder.status === "pending" &&
          reminder.topic.toLocaleLowerCase() ===
            fitted.topic.toLocaleLowerCase() &&
          reminder.expiresAt === examAt.toISOString(),
      );
    if (existing) return existing;
    const pending = this.#repository
      .listSmsReminders(options.learnerId)
      .filter((reminder) => reminder.status === "pending");
    if (pending.length >= 3) {
      throw new Error("This learner already has the maximum pending reminders.");
    }
    const now = nowDate.toISOString();
    const reminder = SmsReminderSchema.parse({
      id: this.#makeId(),
      learnerId: options.learnerId,
      kind: internal.kind,
      topic: fitted.topic,
      message: fitted.message,
      recipientPhoneHash,
      encryptedRecipient: protectCallbackDestination(
        phoneNumber,
        this.#encryptionSecret,
      ),
      dueAt: dueAt.toISOString(),
      expiresAt: examAt.toISOString(),
      status: "pending",
      claimToken: null,
      claimExpiresAt: null,
      providerMessageSid: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
    });
    this.#repository.saveSmsReminder(reminder);
    this.#repository.saveGuardianAuthorization({
      ...authorization,
      proactiveCallsAllowed: true,
      updatedAt: now,
    });
    this.#recordMetric(reminder, "sms_reminder_scheduled", now);
    return reminder;
  }

  scheduleCallbackNudge(options: {
    learnerId: string;
    recipientPhoneNumber: string;
    topic: string;
    dueAt: string;
    consentConfirmed: boolean;
  }): SmsReminder {
    const dueAt = new Date(options.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      throw new Error("A valid callback reminder time is required.");
    }
    const expiresAt = new Date(dueAt.getTime() + 24 * 60 * 60_000);
    return this.scheduleExamReview({
      ...options,
      examAt: expiresAt.toISOString(),
    }, { kind: "callback_nudge" });
  }

  cancelAll(learnerId: string): number {
    const now = this.#clock().toISOString();
    const cancelled = this.#repository.cancelPendingSmsReminders(learnerId, now);
    if (cancelled > 0) {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "sms_reminder_cancelled",
          learnerId,
          sessionId: null,
          channel: "sms",
          accessMode: "unknown",
          numericValue: cancelled,
          synthetic: false,
          createdAt: now,
        }),
      );
    }
    return cancelled;
  }

  async runDue(
    send: (options: { to: string; body: string }) => Promise<{ sid?: string } | void>,
  ): Promise<{ sent: number; cancelled: number; deferred: number; failed: number }> {
    const nowDate = this.#clock();
    const now = nowDate.toISOString();
    const reminders = this.#repository.claimDueSmsReminders({
      now,
      claimToken: this.#makeId(),
      claimExpiresAt: new Date(nowDate.getTime() + 5 * 60_000).toISOString(),
      limit: 20,
    });
    const result = { sent: 0, cancelled: 0, deferred: 0, failed: 0 };
    for (const reminder of reminders) {
      const authorization = this.#repository.findGuardianAuthorization(
        reminder.learnerId,
      );
      if (
        nowDate >= new Date(reminder.expiresAt) ||
        !authorization?.smsAllowed ||
        !authorization.proactiveCallsAllowed ||
        authorization.guardianPhoneHash !== reminder.recipientPhoneHash
      ) {
        this.#repository.saveSmsReminder({
          ...reminder,
          status: "cancelled",
          claimToken: null,
          claimExpiresAt: null,
          updatedAt: now,
        });
        result.cancelled += 1;
        continue;
      }
      if (
        isQuietHour(
          localHour(nowDate, this.#timeZone),
          this.#quietStartHour,
          this.#quietEndHour,
        )
      ) {
        const next = nextAllowedInstant({
          now: nowDate,
          timeZone: this.#timeZone,
          quietStartHour: this.#quietStartHour,
          quietEndHour: this.#quietEndHour,
        });
        this.#repository.saveSmsReminder({
          ...reminder,
          status: next < new Date(reminder.expiresAt) ? "pending" : "cancelled",
          dueAt: next.toISOString(),
          claimToken: null,
          claimExpiresAt: null,
          updatedAt: now,
        });
        result.deferred += 1;
        continue;
      }
      try {
        const sent = await send({
          to: revealCallbackDestination(
            reminder.encryptedRecipient,
            this.#encryptionSecret,
          ),
          body: reminder.message,
        });
        this.#repository.saveSmsReminder({
          ...reminder,
          status: "sent",
          claimToken: null,
          claimExpiresAt: null,
          providerMessageSid: sent?.sid ?? null,
          updatedAt: now,
          sentAt: now,
        });
        this.#recordMetric(reminder, "sms_reminder_sent", now);
        result.sent += 1;
      } catch {
        this.#repository.saveSmsReminder({
          ...reminder,
          status: "failed",
          claimToken: null,
          claimExpiresAt: null,
          updatedAt: now,
        });
        result.failed += 1;
      }
    }
    return result;
  }

  #recordMetric(
    reminder: SmsReminder,
    name: "sms_reminder_scheduled" | "sms_reminder_sent",
    createdAt: string,
  ): void {
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name,
        learnerId: reminder.learnerId,
        sessionId: null,
        channel: "sms",
        accessMode: "unknown",
        numericValue: null,
        synthetic: false,
        createdAt,
      }),
    );
  }
}
