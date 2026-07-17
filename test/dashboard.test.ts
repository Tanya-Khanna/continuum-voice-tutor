import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { buildDashboardSnapshot } from "../src/observability/dashboard.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

describe("mission-control snapshot", () => {
  it("exposes teaching evidence without learner names or phone numbers", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: "dashboard-test-secret-12345",
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+919999988888",
      learnerName: "Private Learner Name",
    });
    await service.respond(
      context,
      "One fourth is bigger because four is bigger than three.",
    );

    const snapshot = buildDashboardSnapshot({
      repository,
      curriculumPack: fractionsPack,
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]).toMatchObject({
      learner_ref: expect.stringMatching(/^learner_[a-f0-9]{10}$/u),
      turn_count: 1,
      turns: [
        expect.objectContaining({
          model_route: "offline",
          next_strategy: "concrete_analogy",
        }),
      ],
    });
    expect(serialized).not.toContain("Private Learner Name");
    expect(serialized).not.toContain("+919999988888");
    repository.close();
  });
});
