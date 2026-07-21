import { describe, expect, it } from "vitest";
import {
  OpenTopicModelTurnSchema,
  OpenTopicRequestSchema,
  applyTrustedOpenTopicInvariants,
  openTopicVoicePolicyFailures,
  openTopicPolicyFailures,
} from "../src/domain/open-topic.js";

function fixture() {
  const request = OpenTopicRequestSchema.parse({
    learnerId: "invariant-learner",
    learnerInput: "Teach me how much medicine to take.",
    requestedLanguageMode: "en",
    phase: "diagnose",
    currentTopic: null,
    previousPrompt: "What would you like to learn?",
    previousDiagnosis: "No evidence yet.",
    previousStrategy: "ask_reasoning",
    previousMastery: "needs_support",
    previousTurns: [],
    responseMode: "speech",
    hintCount: 0,
    latestFeedback: null,
    consentedPreferences: null,
  });
  const proposed = OpenTopicModelTurnSchema.parse({
    learningIntent: {
      learnerWords: request.learnerInput,
      topicOrQuestion: "medicine dosage",
      desiredOutcome: "understand",
      statedTimeConstraint: null,
      languageMode: "en",
      codeSwitchingObserved: false,
      safetyFlags: ["medical", "unsafe_request"],
    },
    topicPlan: {
      topic: "medicine dosage",
      objective: "Set a safe boundary.",
      priorKnowledgeQuestion: "Can you reach a trusted adult or clinician?",
      prerequisites: [],
      possibleMisconceptions: [],
      candidateMethods: ["socratic_prompt"],
      transferGoal: "Seek qualified help.",
      knowledgeState: "high_stakes",
    },
    diagnosis: "The learner misunderstands medicine.",
    diagnosisBasis: "learner_reasoning",
    misconception: "Any dosage is safe.",
    strategy: "safety_redirect",
    strategyReason: "Dosage advice requires qualified support.",
    activityKind: "socratic_prompt",
    languageMode: "en",
    spokenResponse: "I cannot choose a medicine dose for you. Can you ask a trusted adult or clinician now?",
    nextQuestion: "Can you ask a trusted adult or clinician now?",
    evidenceKind: "diagnostic",
    evidenceResult: "incorrect",
    masteryStatus: "secure",
    masteryEvidence: "The learner asked a question.",
    keypadChoices: [],
    expectedChoiceKey: null,
    smsFollowUp: null,
    humanSupport: "none",
    shouldEndSession: false,
  });
  return { request, proposed };
}

describe("trusted open-topic invariants", () => {
  it("cannot invent initial evidence and derives the conservative safety route", () => {
    const { request, proposed } = fixture();
    const turn = applyTrustedOpenTopicInvariants(request, proposed);
    expect(turn.diagnosisBasis).toBe("no_evidence");
    expect(turn.misconception).toBeNull();
    expect(turn.evidenceResult).toBe("unclear");
    expect(turn.masteryStatus).toBe("needs_support");
    expect(turn.topicPlan.knowledgeState).toBe("unsafe");
    expect(turn.humanSupport).toBe("immediate_safety_protocol");
    expect(openTopicPolicyFailures(request, turn)).toEqual([]);
  });

  it("rejects a multi-question voice turn before telephony", () => {
    const { proposed } = fixture();
    const malformed = OpenTopicModelTurnSchema.parse({
      ...proposed,
      spokenResponse: "What do you think? Can you explain why?",
      nextQuestion: "Can you explain why?",
    });
    expect(openTopicVoicePolicyFailures(malformed)).toContain(
      "spoken response had 2 questions; expected 1",
    );
  });

  it("derives the exact checkpoint from one final spoken question", () => {
    const { request, proposed } = fixture();
    const drifted = OpenTopicModelTurnSchema.parse({
      ...proposed,
      spokenResponse:
        "I cannot choose a medicine dose for you. Can you ask a trusted adult or clinician now?",
      nextQuestion: "Could you contact a medical professional?",
    });
    const turn = applyTrustedOpenTopicInvariants(request, drifted);
    expect(turn.nextQuestion).toBe(
      "Can you ask a trusted adult or clinician now?",
    );
    expect(openTopicVoicePolicyFailures(turn)).toEqual([]);
  });
});
