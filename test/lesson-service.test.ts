import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashPhoneNumber } from "../src/domain/identity.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const temporaryDirectories: string[] = [];
const PHONE_HASH_SECRET = "test-phone-secret-12345";

function makeDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "nomad-ai-test-"));
  temporaryDirectories.push(directory);
  return join(directory, "nomad.db");
}

function sequentialIds(): () => string {
  let counter = 0;
  return () => `test-id-${++counter}`;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("LessonService", () => {
  it("keeps named learners separate on a shared phone", () => {
    const repository = new SqliteLearningRepository(makeDatabasePath());
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(),
      makeId: sequentialIds(),
      phoneHashSecret: PHONE_HASH_SECRET,
    });

    const ravi = service.beginOrResume({
      phoneNumber: "+91 99999 11111",
      learnerName: "Ravi",
    });
    const asha = service.beginOrResume({
      phoneNumber: "+91 99999 11111",
      learnerName: "Asha",
    });

    expect(ravi.learner.id).not.toBe(asha.learner.id);
    expect(
      repository
        .listLearnersForPhone(
          hashPhoneNumber("+91 99999 11111", PHONE_HASH_SECRET),
        )
        .map((learner) => learner.name),
    ).toEqual(["Ravi", "Asha"]);
    repository.close();
  });

  it("resumes the exact teaching question after reopening the database", async () => {
    const databasePath = makeDatabasePath();
    const firstRepository = new SqliteLearningRepository(databasePath);
    const firstService = new LessonService({
      repository: firstRepository,
      engine: new OfflineTeachingEngine(),
      makeId: sequentialIds(),
      phoneHashSecret: PHONE_HASH_SECRET,
    });
    let firstContext = firstService.beginOrResume({
      phoneNumber: "+91 99999 22222",
      learnerName: "Ravi",
    });
    const response = await firstService.respond(
      firstContext,
      "One fourth is bigger because four is bigger than three.",
    );
    firstContext = firstService.pause(response.context);
    const expectedPrompt = firstContext.session.lastPrompt;
    firstRepository.close();

    const secondRepository = new SqliteLearningRepository(databasePath);
    const secondService = new LessonService({
      repository: secondRepository,
      engine: new OfflineTeachingEngine(),
      makeId: sequentialIds(),
      phoneHashSecret: PHONE_HASH_SECRET,
    });
    const resumed = secondService.beginOrResume({
      phoneNumber: "+91 99999 22222",
      learnerName: "ravi",
    });

    expect(resumed.resumed).toBe(true);
    expect(resumed.session.turnCount).toBe(1);
    expect(resumed.greeting).toContain(expectedPrompt);
    expect(secondRepository.listTurns(resumed.session.id)).toHaveLength(1);
    secondRepository.close();
  });

  it("records a learner's code-switching language mode", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(),
      makeId: sequentialIds(),
      phoneHashSecret: PHONE_HASH_SECRET,
    });
    const context = service.beginOrResume({
      phoneNumber: "+91 99999 33333",
      learnerName: "Asha",
      preferredLanguage: "en",
    });

    const response = await service.respond(
      context,
      "Mujhe lagta hai one fourth is bigger.",
    );

    expect(response.turn.language_mode).toBe("hinglish");
    expect(repository.findLearner(context.learner.id)?.preferredLanguage).toBe(
      "hinglish",
    );
    repository.close();
  });
});
