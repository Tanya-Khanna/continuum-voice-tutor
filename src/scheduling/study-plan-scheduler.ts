import { randomUUID } from "node:crypto";
import type { LearningRepository } from "../domain/learner.js";
import { StudyPlanSchema, type StudyPlan } from "../domain/study-plan.js";
import { nextScheduledCall } from "./schedule-time.js";
import { revealCallbackDestination } from "../telephony/missed-call-callback.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";

export interface ScheduledDialRequest {
  learnerId: string;
  to: string;
  durationMinutes: 3 | 5 | 10;
}

export class StudyPlanScheduler {
  readonly #repository: LearningRepository;
  readonly #callbackSecret: string;
  readonly #clock: () => Date;
  readonly #dial: (request: ScheduledDialRequest) => Promise<void>;

  constructor(options: {
    repository: LearningRepository;
    callbackSecret: string;
    dial: (request: ScheduledDialRequest) => Promise<void>;
    clock?: () => Date;
  }) {
    this.#repository = options.repository;
    this.#callbackSecret = options.callbackSecret;
    this.#dial = options.dial;
    this.#clock = options.clock ?? (() => new Date());
  }

  async runDue(limit = 20): Promise<{
    claimed: number;
    dialed: number;
    paused: number;
    failed: number;
  }> {
    const nowDate = this.#clock();
    const now = nowDate.toISOString();
    const claimToken = randomUUID();
    const plans = this.#repository.claimDueStudyPlans({
      now,
      claimToken,
      claimExpiresAt: new Date(nowDate.getTime() + 5 * 60_000).toISOString(),
      limit,
    });
    let dialed = 0;
    let paused = 0;
    let failed = 0;
    for (const plan of plans) {
      const authorization = this.#repository.findGuardianAuthorization(
        plan.learnerId,
      );
      if (
        !plan.guardianConsent ||
        !authorization?.proactiveCallsAllowed
      ) {
        this.#repository.saveStudyPlan(
          StudyPlanSchema.parse({
            ...plan,
            status: "paused",
            nextScheduledCall: null,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: now,
          }),
        );
        paused += 1;
        continue;
      }
      try {
        await this.#dial({
          learnerId: plan.learnerId,
          to: revealCallbackDestination(
            plan.encryptedContactNumber,
            this.#callbackSecret,
          ),
          durationMinutes: plan.durationMinutes,
        });
        const afterSlot = new Date(nowDate.getTime() + 60_000);
        this.#repository.saveStudyPlan(
          StudyPlanSchema.parse({
            ...plan,
            nextScheduledCall: nextScheduledCall({
              now: afterSlot,
              weekdays: plan.preferredWeekdays,
              localStartTime: plan.localStartTime,
              timeZone: plan.deploymentTimezone,
            }),
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: now,
          }),
        );
        this.#repository.appendProductMetric(
          ProductMetricEventSchema.parse({
            id: randomUUID(),
            name: "scheduled_call_dialed",
            learnerId: plan.learnerId,
            sessionId: null,
            channel: "system",
            accessMode: "scheduled",
            numericValue: plan.durationMinutes,
            synthetic: false,
            createdAt: now,
          }),
        );
        dialed += 1;
      } catch {
        this.#repository.saveStudyPlan(
          StudyPlanSchema.parse({
            ...plan,
            nextScheduledCall: nextScheduledCall({
              now: new Date(nowDate.getTime() + 60_000),
              weekdays: plan.preferredWeekdays,
              localStartTime: plan.localStartTime,
              timeZone: plan.deploymentTimezone,
            }),
            missedLessons: plan.missedLessons + 1,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: now,
          }),
        );
        this.#repository.appendProductMetric(
          ProductMetricEventSchema.parse({
            id: randomUUID(),
            name: "scheduled_call_failed",
            learnerId: plan.learnerId,
            sessionId: null,
            channel: "system",
            accessMode: "scheduled",
            numericValue: null,
            synthetic: false,
            createdAt: now,
          }),
        );
        failed += 1;
      }
    }
    return { claimed: plans.length, dialed, paused, failed };
  }
}
