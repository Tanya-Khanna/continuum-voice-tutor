import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { redactPotentialPii } from "../src/privacy/redact-pii.js";

describe("learner-answer privacy", () => {
  it("redacts common contact and address disclosures without changing math notation", () => {
    const redacted = redactPotentialPii(
      "Email me at learner@example.com, call +1 (415) 555-0199, and I live at 10 Main Street. I chose 1/3.",
    );

    expect(redacted).not.toContain("learner@example.com");
    expect(redacted).not.toContain("415");
    expect(redacted).not.toContain("10 Main Street");
    expect(redacted).toContain("1/3");
  });

  it("redacts before model processing and persistence", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: "privacy-test-secret-12345",
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+919999900123",
      learnerName: "Demo",
    });
    const result = await service.respond(
      context,
      "I am holding a leaf. My email is learner@example.com, and I live at 10 Main Street.",
    );

    expect(result.turn.learner_answer).toContain("[email redacted]");
    expect(result.turn.learner_answer).not.toContain("learner@example.com");
    expect(result.turn.learner_answer).not.toContain("10 Main Street");
    expect(result.turn.anchor_object).toBe("leaf");
    expect(
      repository.listTurns(result.context.session.id)[0]?.turn.learner_answer,
    ).not.toContain("learner@example.com");
    repository.close();
  });
});
