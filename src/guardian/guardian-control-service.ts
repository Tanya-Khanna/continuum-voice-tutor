import type { LearningRepository } from "../domain/learner.js";
import { StudyPlanSchema } from "../domain/study-plan.js";
import { nextScheduledCall } from "../scheduling/schedule-time.js";

export class GuardianControlService {
  readonly #repository: LearningRepository;
  readonly #clock: () => Date;

  constructor(options: {
    repository: LearningRepository;
    clock?: () => Date;
  }) {
    this.#repository = options.repository;
    this.#clock = options.clock ?? (() => new Date());
  }

  progressSummary(learnerId: string): string {
    const learner = this.#repository.findLearner(learnerId);
    if (!learner) return "That learning profile is no longer available.";
    const lessons = this.#repository
      .listRecentLessons(100)
      .filter((lesson) => lesson.learnerId === learnerId);
    const latest = lessons[0];
    const plan = this.#repository.findStudyPlan(learnerId);
    const review = plan?.reviewQueue.length
      ? `${plan.reviewQueue.length} review item${plan.reviewQueue.length === 1 ? "" : "s"} due.`
      : "No review item is currently due.";
    return latest
      ? `${learner.name} has ${lessons.length} recorded lesson${lessons.length === 1 ? "" : "s"}. Current progress is ${latest.masteryStatus.replace("_", " ")}. ${review}`
      : `${learner.name} has no completed lesson yet. ${review}`;
  }

  changeTime(learnerId: string, compactTime: string): string {
    if (!/^([01]\d|2[0-3])[0-5]\d$/u.test(compactTime)) {
      return "That time was not valid. Enter four digits, such as one nine zero zero, then press pound.";
    }
    const plan = this.#repository.findStudyPlan(learnerId);
    if (!plan) return "No study schedule exists yet.";
    const localStartTime = `${compactTime.slice(0, 2)}:${compactTime.slice(2)}`;
    const nowDate = this.#clock();
    this.#repository.saveStudyPlan(
      StudyPlanSchema.parse({
        ...plan,
        localStartTime,
        nextScheduledCall:
          plan.status === "active"
            ? nextScheduledCall({
                now: nowDate,
                weekdays: plan.preferredWeekdays,
                localStartTime,
                timeZone: plan.deploymentTimezone,
              })
            : null,
        updatedAt: nowDate.toISOString(),
      }),
    );
    return `Lesson time changed to ${localStartTime}.`;
  }

  toggleCalls(learnerId: string): string {
    const plan = this.#repository.findStudyPlan(learnerId);
    const authorization = this.#repository.findGuardianAuthorization(learnerId);
    if (!plan || !authorization) return "No consented study schedule exists yet.";
    const nowDate = this.#clock();
    const activating = plan.status === "paused";
    this.#repository.saveGuardianAuthorization({
      ...authorization,
      proactiveCallsAllowed: activating,
      updatedAt: nowDate.toISOString(),
    });
    this.#repository.saveStudyPlan(
      StudyPlanSchema.parse({
        ...plan,
        guardianConsent: activating,
        status: activating ? "active" : "paused",
        nextScheduledCall: activating
          ? nextScheduledCall({
              now: nowDate,
              weekdays: plan.preferredWeekdays,
              localStartTime: plan.localStartTime,
              timeZone: plan.deploymentTimezone,
            })
          : null,
        updatedAt: nowDate.toISOString(),
      }),
    );
    return activating ? "Future lesson calls resumed." : "Future lesson calls paused.";
  }

  deleteProfile(learnerId: string): string {
    if (!this.#repository.findLearner(learnerId)) {
      return "That learning profile is already unavailable.";
    }
    this.#repository.deleteLearnerData(learnerId);
    return "Learning profile deleted and future calls cancelled.";
  }
}
