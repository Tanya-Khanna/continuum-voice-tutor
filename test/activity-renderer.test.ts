import { describe, expect, it } from "vitest";
import {
  LearningActivityKindSchema,
  LearningActivitySchema,
} from "../src/domain/classroom.js";
import { renderLearningActivity } from "../src/lesson/activity-renderer.js";

describe("voice-native activity renderer", () => {
  it.each(LearningActivityKindSchema.options)(
    "renders %s without learner data in the judge proof",
    (kind) => {
      const activity = LearningActivitySchema.parse({
        id: `activity-${kind}`,
        kind,
        objective: "Use reviewed evidence to explain the concept.",
        voiceScript: "Think about the two choices. Which one fits the rule?",
        expectedResponse: "choice",
        reviewedQuestionId: "reviewed-question",
        keypadChoices: [
          { key: "1", label: "first choice", reviewedAnswerId: "first" },
          { key: "2", label: "second choice", reviewedAnswerId: "second" },
        ],
        smsText: "Q: choose 1 or 2. Reply with your answer.",
        estimatedSeconds: 30,
        canCreateMasteryEvidence: kind === "transfer",
      });
      const rendered = renderLearningActivity(activity);
      expect(rendered.speech.script).toBe(activity.voiceScript);
      expect(rendered.dtmf).toMatchObject({ supported: true });
      expect(rendered.dtmf.instructions).toContain("Press 1");
      expect(rendered.sms).toMatchObject({ supported: true, segments: 1 });
      expect(rendered.judgeProof).toMatchObject({
        activityId: activity.id,
        kind,
        reviewedQuestionId: "reviewed-question",
      });
      expect(JSON.stringify(rendered.judgeProof)).not.toContain("learner");
    },
  );

  it("marks unavailable feature-phone channels explicitly", () => {
    const rendered = renderLearningActivity(
      LearningActivitySchema.parse({
        id: "spoken-reflection",
        kind: "reflection",
        objective: "Reflect on learning.",
        voiceScript: "What feels clearer now?",
        expectedResponse: "reflection",
        keypadChoices: [],
        smsText: null,
        estimatedSeconds: 20,
        canCreateMasteryEvidence: false,
      }),
    );
    expect(rendered.dtmf).toMatchObject({ supported: false, instructions: null });
    expect(rendered.sms).toMatchObject({ supported: false, text: null, segments: 0 });
  });
});
