import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import {
  LessonService,
  targetTurnsForDuration,
} from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "learning-evidence-test-secret";

describe("lesson learning evidence", () => {
  it("uses distinct trusted activity targets for 3, 5, and 10 minute lessons", () => {
    const base = fractionsPack.lessonPolicy.targetTurns;
    expect(targetTurnsForDuration(base, 3)).toBeLessThan(
      targetTurnsForDuration(base, 5),
    );
    expect(targetTurnsForDuration(base, 5)).toBe(base);
    expect(targetTurnsForDuration(base, 10)).toBeGreaterThan(base);
  });

  it("persists an auditable activity, evidence item, and pedagogy decision", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+91 90000 00001",
      learnerName: "Meena",
    });

    const result = await service.respond(
      context,
      "One fourth is bigger because four is bigger than three.",
    );

    expect(result.activity).toMatchObject({
      kind: "analogy",
      objective: expect.any(String),
      expectedResponse: "open_speech",
    });
    expect(result.evidence).toMatchObject({
      kind: "diagnostic",
      result: "incorrect",
      responseMode: "speech",
    });
    expect(repository.listLearningEvidence(context.learner.id)).toEqual([
      result.evidence,
    ]);
    expect(repository.listPedagogyDecisions(context.session.id)).toEqual([
      result.decision,
    ]);
    repository.close();
  });

  it("changes method after the learner marks the previous explanation unhelpful", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+91 90000 00002",
      learnerName: "Meena",
    });
    const first = await service.respond(
      context,
      "One fourth is bigger because four is bigger than three.",
    );
    const feedback = service.recordTeachingFeedback(first.context, {
      helpfulness: "not_helpful",
      pace: "too_fast",
      objectiveResult: "incorrect",
      responseMode: "dtmf",
    });
    const second = await service.respond(
      first.context,
      "One fourth is bigger because four is bigger than three.",
    );

    expect(feedback.strategy).toBe("concrete_analogy");
    expect(second.turn.next_strategy).toBe("smaller_step");
    expect(second.decision.strategyChanged).toBe(true);
    expect(second.decision.strategyReason).toContain("not helpful");
    expect(repository.listTeachingFeedback(context.learner.id)).toEqual([
      feedback,
    ]);
    repository.close();
  });

  it("stores only explicitly consented aspirations and preferences", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+91 90000 00003",
      learnerName: "Meena",
    });

    expect(() =>
      service.updateEducationProfile(context, {
        consentConfirmed: false,
        aspirations: ["nurse"],
      }),
    ).toThrow(/explicit learner consent/);
    const profile = service.updateEducationProfile(context, {
      consentConfirmed: true,
      interests: ["how medicines work"],
      aspirations: ["nurse"],
      preferredActivities: ["story", "quiz"],
      preferredPace: "right",
    });
    expect(profile).toMatchObject({
      aspirations: ["nurse"],
      preferredActivities: ["story", "quiz"],
      consentedFields: expect.arrayContaining([
        "interests",
        "aspirations",
        "preferred_activities",
        "preferred_pace",
      ]),
    });
    expect(service.educationProfile(context)).toEqual(profile);
    repository.close();
  });

  it("asks for learner reflection after transfer and preserves mastery during recap", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    let context = service.beginOrResume({
      phoneNumber: "+91 90000 00004",
      learnerName: "Meena",
    });
    let result;
    for (let turn = 1; turn <= fractionsPack.lessonPolicy.targetTurns; turn += 1) {
      result = await service.respond(
        context,
        turn === fractionsPack.lessonPolicy.targetTurns
          ? "I understand that fewer equal pieces means each piece is bigger."
          : "One third is bigger because three equal pieces are bigger than five equal pieces.",
      );
      context = result.context;
      if (turn === fractionsPack.lessonPolicy.targetTurns - 1) {
        expect(result.activity.kind).toBe("reflection");
        expect(result.turn.next_strategy).toBe("reflection");
      }
    }
    expect(result!.activity.kind).toBe("recap");
    expect(result!.evidence.kind).toBe("reflection");
    expect(context.session.status).toBe("completed");
    repository.close();
  });

  it("renders a reviewed transfer choice and caps keypad-only evidence below secure mastery", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    let context = service.beginOrResume({
      phoneNumber: "+91 90000 00005",
      learnerName: "Meena",
    });
    let transferActivity;
    for (
      let turn = 1;
      turn <= fractionsPack.lessonPolicy.targetTurns - 2;
      turn += 1
    ) {
      const result = await service.respond(
        context,
        "One third is bigger because the same whole is divided into fewer equal pieces.",
      );
      context = result.context;
      transferActivity = result.activity;
    }

    expect(transferActivity).toMatchObject({
      kind: "transfer",
      expectedResponse: "choice",
      reviewedQuestionId: "compare_fifths_eighths_keypad",
      keypadChoices: [
        { key: "1", reviewedAnswerId: "one_fifth" },
        { key: "2", reviewedAnswerId: "one_eighth" },
        { key: "3", reviewedAnswerId: "equal" },
      ],
    });
    const keypadResult = await service.respond(context, "one fifth", {
      responseMode: "dtmf",
    });
    expect(keypadResult.evidence).toMatchObject({
      kind: "transfer",
      responseMode: "dtmf",
      independent: false,
    });
    expect(keypadResult.context.session.masteryStatus).not.toBe("secure");
    repository.close();
  });
});
