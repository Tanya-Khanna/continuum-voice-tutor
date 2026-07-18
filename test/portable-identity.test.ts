import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { PortableIdentityService } from "../src/domain/portable-identity.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "portable-identity-test-secret";

function setup() {
  const repository = new SqliteLearningRepository(":memory:");
  const lessons = new LessonService({
    repository,
    engine: new OfflineTeachingEngine(fractionsPack),
    phoneHashSecret: SECRET,
    curriculumPack: fractionsPack,
  });
  const learner = lessons.identifyLearner({
    phoneNumber: "+91 99999 11111",
    learnerName: "Meena",
  });
  let id = 0;
  const identity = new PortableIdentityService({
    repository,
    secret: SECRET,
    makeCode: () => "482913",
    makeId: () => `attempt-${++id}`,
    clock: () => new Date("2026-07-18T12:00:00.000Z"),
  });
  return { repository, learner, identity, lessons };
}

describe("PortableIdentityService", () => {
  it("resolves a learner from another phone without storing the raw code", () => {
    const { repository, learner, identity, lessons } = setup();
    lessons.beginOrResumeSubject(learner);
    const code = identity.issue(learner.id);

    expect(code).toBe("482913");
    expect(JSON.stringify(repository.findLearnerAccessCode(learner.id))).not.toContain(code);
    expect(
      identity.verify({
        code,
        sourcePhoneNumber: "+91 88888 22222",
        attemptsThisCall: 0,
      }),
    ).toMatchObject({ status: "matched", learner: { id: learner.id } });
    expect(repository.listProductMetrics()).toMatchObject([
      { name: "cross_phone_resumed", learnerId: learner.id },
    ]);
    repository.close();
  });

  it("blocks a fourth attempt in the same call", () => {
    const { repository, identity } = setup();
    expect(
      identity.verify({
        code: "111111",
        sourcePhoneNumber: "+91 88888 22222",
        attemptsThisCall: 3,
      }),
    ).toEqual({ status: "blocked", retryAfterSeconds: 600 });
    repository.close();
  });

  it("invalidates the prior code after guardian-assisted rotation", () => {
    const { repository, learner, identity } = setup();
    identity.issue(learner.id);
    let code = "271400";
    const rotating = new PortableIdentityService({
      repository,
      secret: SECRET,
      makeCode: () => code,
    });
    expect(rotating.issue(learner.id)).toBe(code);
    expect(
      rotating.verify({
        code: "482913",
        sourcePhoneNumber: "+91 88888 22222",
        attemptsThisCall: 0,
      }).status,
    ).toBe("invalid");
    expect(
      rotating.verify({
        code,
        sourcePhoneNumber: "+91 88888 22222",
        attemptsThisCall: 1,
      }).status,
    ).toBe("matched");
    repository.close();
  });
});
