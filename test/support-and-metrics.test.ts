import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { humanSupportDecisionFor } from "../src/domain/classroom.js";
import { EducatorAssignmentSchema } from "../src/domain/educator.js";
import { ProductMetricEventSchema } from "../src/domain/product-metrics.js";
import { EducatorSummaryService } from "../src/educator/educator-summary-service.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { buildProductMetrics } from "../src/observability/product-metrics.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "support-metrics-test-secret";

describe("human support, educator boundary, and product proof", () => {
  it("separates ordinary struggle from safety and qualified review", () => {
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: false,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 2,
      }),
    ).toBe("none");
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: false,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 3,
      }),
    ).toBe("suggest_teacher");
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: true,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 0,
      }),
    ).toBe("safety_protocol");
  });

  it("builds an authorized educator summary without raw conversations", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const lessons = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = lessons.beginOrResume({
      phoneNumber: "+919999900001",
      learnerName: "Meena",
    });
    await lessons.respond(
      context,
      "One fourth is bigger because four is bigger than three.",
    );
    const assignment = EducatorAssignmentSchema.parse({
      id: "assignment-1",
      learnerId: context.learner.id,
      educatorId: "facilitator-1",
      curriculumPackId: fractionsPack.id,
      conceptId: context.session.concept,
      learnerAuthorized: true,
      guardianAuthorized: true,
      authorizationExpiresAt: null,
      createdAt: "2026-07-18T12:00:00.000Z",
    });
    const summary = new EducatorSummaryService({
      repository,
      clock: () => new Date("2026-07-18T12:05:00.000Z"),
    }).build(assignment, "Math");
    expect(summary).toMatchObject({
      displayName: "Meena",
      assignedSubject: "Math",
      excludesRawConversations: true,
    });
    expect(JSON.stringify(summary)).not.toContain(
      "One fourth is bigger because four is bigger than three.",
    );
    expect(() =>
      new EducatorSummaryService({ repository }).build(
        { ...assignment, guardianAuthorized: false },
        "Math",
      ),
    ).toThrow(/authorization/);
    repository.close();
  });

  it("separates access, reliability, and learning metrics with evidence labels", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const now = "2026-07-18T12:00:00.000Z";
    for (const [index, name] of [
      "missed_call_queued",
      "callback_placed",
      "drop_paused",
      "drop_recovered",
    ].entries()) {
      repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: `metric-${index}`,
          name,
          learnerId: null,
          sessionId: null,
          channel: "system",
          accessMode: "missed_call",
          numericValue: null,
          synthetic: true,
          createdAt: now,
        }),
      );
    }
    expect(buildProductMetrics(repository)).toMatchObject({
      evidenceScope: "synthetic",
      access: { missedCallCallbackConversion: 1 },
      reliability: { droppedCallRecoveryRate: 1 },
    });
    repository.close();
  });
});
