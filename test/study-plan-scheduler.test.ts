import { describe, expect, it, vi } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { StudyPlanSchema } from "../src/domain/study-plan.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { GuardianAccessService } from "../src/guardian/guardian-access-service.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { StudyPlanScheduler } from "../src/scheduling/study-plan-scheduler.js";
import { protectCallbackDestination } from "../src/telephony/missed-call-callback.js";

const SECRET = "scheduler-test-secret-12345";

describe("StudyPlanScheduler", () => {
  it("locks a due slot, dials it once, and schedules the next regular slot", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const lessonService = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const learner = lessonService.identifyLearner({
      phoneNumber: "+919999900001",
      learnerName: "Meena",
    });
    new GuardianAccessService({
      repository,
      secret: SECRET,
      phoneHashSecret: SECRET,
      makeCode: () => "654321",
    }).issue({
      learnerId: learner.id,
      guardianPhoneNumber: "+919999900001",
      smsAllowed: true,
      proactiveCallsAllowed: true,
    });
    repository.saveStudyPlan(
      StudyPlanSchema.parse({
        id: "plan-1",
        learnerId: learner.id,
        goal: "Review fractions",
        subjects: ["Math"],
        currentLevels: {},
        reviewQueue: [learner.currentConcept],
        nextConcepts: [],
        preferredWeekdays: ["MON", "WED", "FRI"],
        localStartTime: "19:00",
        deploymentTimezone: "Asia/Kolkata",
        durationMinutes: 5,
        guardianConsent: true,
        encryptedContactNumber: protectCallbackDestination(
          "+919999900001",
          SECRET,
        ),
        status: "active",
        nextScheduledCall: "2026-07-18T11:59:00.000Z",
        missedLessons: 0,
        lastCompletion: null,
        claimToken: null,
        claimExpiresAt: null,
        createdAt: "2026-07-18T10:00:00.000Z",
        updatedAt: "2026-07-18T10:00:00.000Z",
      }),
    );
    const dial = vi.fn(async () => undefined);
    const scheduler = new StudyPlanScheduler({
      repository,
      callbackSecret: SECRET,
      dial,
      clock: () => new Date("2026-07-18T12:00:00.000Z"),
    });

    await expect(scheduler.runDue()).resolves.toMatchObject({
      claimed: 1,
      dialed: 1,
      failed: 0,
    });
    await expect(scheduler.runDue()).resolves.toMatchObject({ claimed: 0 });
    expect(dial).toHaveBeenCalledOnce();
    expect(dial).toHaveBeenCalledWith({
      learnerId: learner.id,
      to: "+919999900001",
      durationMinutes: 5,
    });
    expect(
      new Date(
        repository.findStudyPlan(learner.id)!.nextScheduledCall!,
      ).getTime(),
    ).toBeGreaterThan(new Date("2026-07-18T12:00:00.000Z").getTime());
    repository.close();
  });
});
