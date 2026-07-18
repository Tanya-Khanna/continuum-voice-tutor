import { describe, expect, it } from "vitest";
import {
  assertSafeEducationalMotivation,
  LearningActivitySchema,
  LearnerEducationProfileSchema,
  masteryMayBeSecure,
  nextReviewAfterDays,
} from "../src/domain/classroom.js";

describe("voice-native classroom contracts", () => {
  it("validates a reviewed keypad quiz", () => {
    const activity = LearningActivitySchema.parse({
      id: "fractions-transfer-1",
      kind: "transfer",
      objective: "Compare unit fractions using the size of equal shares.",
      voiceScript:
        "Which is larger: one-third or one-fifth? Press 1 for one-third or 2 for one-fifth.",
      expectedResponse: "choice",
      reviewedQuestionId: "transfer-1",
      keypadChoices: [
        { key: "1", label: "one-third", reviewedAnswerId: "one-third" },
        { key: "2", label: "one-fifth", reviewedAnswerId: "one-fifth" },
      ],
      smsText: "Which is larger: 1/3 or 1/5? Reply 1 or 2.",
      estimatedSeconds: 20,
      canCreateMasteryEvidence: true,
    });

    expect(activity.keypadChoices).toHaveLength(2);
  });

  it("never treats keypad-only evidence as secure mastery", () => {
    expect(
      masteryMayBeSecure({
        kind: "transfer",
        result: "correct",
        independent: true,
        responseMode: "dtmf",
      }),
    ).toBe(false);
    expect(
      masteryMayBeSecure({
        kind: "transfer",
        result: "correct",
        independent: true,
        responseMode: "speech",
      }),
    ).toBe(true);
  });

  it("uses short spaced-review intervals from evidence", () => {
    expect(
      nextReviewAfterDays({ result: "incorrect", masteryStatus: "needs_support" }),
    ).toBe(1);
    expect(
      nextReviewAfterDays({ result: "correct", masteryStatus: "developing" }),
    ).toBe(3);
    expect(
      nextReviewAfterDays({ result: "correct", masteryStatus: "secure" }),
    ).toBe(7);
  });

  it("requires aspirations to be explicitly represented in consent", () => {
    const profile = LearnerEducationProfileSchema.parse({
      learnerId: "learner-1",
      ageBand: "11_13",
      reportedGrade: 6,
      interests: ["science"],
      aspirations: ["nursing"],
      curiosityTopics: [],
      preferredExamples: ["measuring cups"],
      learningGoals: ["understand fractions"],
      preferredActivities: ["analogy", "quiz"],
      preferredPace: "right",
      consentedFields: [
        "age_band",
        "reported_grade",
        "interests",
        "aspirations",
        "preferred_examples",
        "learning_goals",
        "preferred_activities",
        "preferred_pace",
      ],
      updatedAt: "2026-07-18T12:00:00.000Z",
    });

    expect(profile.consentedFields).toContain("aspirations");
  });

  it("allows relevant aspiration links but rejects dependency and guarantees", () => {
    expect(() =>
      assertSafeEducationalMotivation(
        "You said nursing interests you. Fractions can help you reason about measurements.",
      ),
    ).not.toThrow();
    expect(() =>
      assertSafeEducationalMotivation(
        "I am your only friend, and only I understand you.",
      ),
    ).toThrow(/manipulative dependency/u);
    expect(() =>
      assertSafeEducationalMotivation(
        "This lesson will make you a nurse.",
      ),
    ).toThrow(/career-guarantee/u);
  });
});
