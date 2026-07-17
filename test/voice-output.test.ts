import { describe, expect, it } from "vitest";
import type { TeachingTurn } from "../src/domain/teaching.js";
import {
  assertVoiceNativeTeachingTurn,
  voiceOutputFailures,
} from "../src/domain/voice-output.js";

const baseTurn: TeachingTurn = {
  learner_id: "voice-test",
  concept: "comparing_unit_fractions",
  learner_answer: "One third because the pieces are bigger.",
  diagnosis: "The learner used valid piece-size reasoning.",
  reasoning_trace: [
    {
      source: "learner_stated",
      claim: "Fewer equal pieces are bigger.",
      status: "supported",
    },
    {
      source: "tutor_inference",
      claim: "The learner used valid piece-size reasoning.",
      status: "supported",
    },
  ],
  language_mode: "en",
  next_strategy: "retrieval_practice",
  mastery_status: "developing",
  mastery_evidence: "One supported explanation.",
  next_question: "Which is larger, one fifth or one eighth, and why?",
  spoken_response:
    "Good reasoning. Which is larger, one fifth or one eighth, and why?",
  should_end_session: false,
};

describe("voice-native teaching policy", () => {
  it("accepts one short spoken question and a stored voice question", () => {
    expect(() => assertVoiceNativeTeachingTurn(baseTurn)).not.toThrow();
  });

  it.each([
    ["Markdown", "**Good**. Which is larger?"],
    ["symbolic fraction", "Try 1/5 and 1/8. Which is larger?"],
    ["two questions", "What do you think? Why?"],
    ["four sentences", "Good. Think. Compare the pieces. Which is larger?"],
  ])("rejects %s before speech", (_label, spokenResponse) => {
    expect(
      voiceOutputFailures({
        ...baseTurn,
        spoken_response: spokenResponse,
      }),
    ).not.toEqual([]);
  });

  it("allows a recap or safety ending to finish without a spoken question", () => {
    for (const nextStrategy of ["recap", "safety_redirect"] as const) {
      expect(() =>
        assertVoiceNativeTeachingTurn({
          ...baseTurn,
          next_strategy: nextStrategy,
          spoken_response: "Thank you for thinking aloud today. Call again when you are ready.",
          should_end_session: true,
        }),
      ).not.toThrow();
    }
  });
});
