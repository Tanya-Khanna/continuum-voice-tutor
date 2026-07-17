import { describe, expect, it } from "vitest";
import { CurriculumCatalog } from "../src/curriculum/catalog.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import {
  DEMO_LEARNER,
  seedDemoState,
} from "../src/demo/seed-demo-state.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { CatalogLessonService } from "../src/lesson/catalog-lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

function makeService(repository: SqliteLearningRepository) {
  const catalog = new CurriculumCatalog([fractionsPack]);
  return new CatalogLessonService({
    repository,
    catalog,
    engineFactory: () => new OfflineTeachingEngine(fractionsPack),
    phoneHashSecret: "demo-seed-test-secret",
  });
}

describe("demo-state seeder", () => {
  it("creates one paused lesson and remains idempotent", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = makeService(repository);

    const first = await seedDemoState({ lessonService: service });
    const second = await seedDemoState({ lessonService: service });

    expect(first).toMatchObject({
      created: true,
      learnerName: "Ravi",
      subject: "Math",
      turnCount: 1,
    });
    expect(second).toEqual({ ...first, created: false });
    const learner = service.identifyLearner({
      phoneNumber: DEMO_LEARNER.phoneNumber,
      learnerName: DEMO_LEARNER.name,
    });
    const lesson = repository.findLatestLesson(
      learner.id,
      fractionsPack.id,
    );
    expect(lesson).toMatchObject({
      status: "paused",
      turnCount: 1,
      placementLevel: "foundational",
      lastPrompt: first.pendingPrompt,
    });
    expect(repository.listTurns(lesson!.id)).toHaveLength(1);

    const resumed = service.beginOrResumeSubject(learner, "Math");
    expect(resumed).toMatchObject({
      resumed: true,
      greeting: expect.stringContaining(first.pendingPrompt),
    });
    service.pause(resumed);
    repository.close();
  });

  it("does not create state for another learner sharing the demo phone", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = makeService(repository);
    await seedDemoState({ lessonService: service });

    const sibling = service.identifyLearner({
      phoneNumber: DEMO_LEARNER.phoneNumber,
      learnerName: "Asha",
    });
    expect(repository.findLatestLesson(sibling.id)).toBeUndefined();
    repository.close();
  });
});
