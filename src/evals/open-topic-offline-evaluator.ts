import { zodTextFormat } from "openai/helpers/zod";
import {
  TeachingFeedbackSchema,
  assertSafeEducationalMotivation,
  masteryMayBeSecure,
} from "../domain/classroom.js";
import {
  OPEN_TOPIC_NAMESPACE,
  OPEN_TOPIC_PROMPT,
  OpenTopicModelTurnSchema,
  OpenTopicRequestSchema,
  enforceHumanSupportForKnowledgeState,
  openTopicPolicyFailures,
  type OpenTopicModelTurn,
  type OpenTopicRequest,
} from "../domain/open-topic.js";
import { TeachingTurnSchema } from "../domain/teaching.js";
import { voiceOutputFailures } from "../domain/voice-output.js";
import { OfflineOpenTopicEngine } from "../engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../lesson/open-topic-lesson-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";
import {
  OPEN_TOPIC_REALTIME_INSTRUCTIONS,
  buildOpenTopicRealtimeAcceptPayload,
} from "../telephony/open-topic-realtime.js";

export interface OpenTopicEvalCaseResult {
  id: string;
  category: string;
  passed: boolean;
  failures: string[];
}

export interface OpenTopicEvalReport {
  total: number;
  passed: number;
  passRate: number;
  voiceFriendlyRate: number;
  results: OpenTopicEvalCaseResult[];
}

const learnerWords = "Teach me why shadows change length.";

function request(
  overrides: Partial<OpenTopicRequest> = {},
): OpenTopicRequest {
  return OpenTopicRequestSchema.parse({
    learnerId: "eval-learner",
    learnerInput: learnerWords,
    requestedLanguageMode: "en",
    phase: "diagnose",
    currentTopic: null,
    previousPrompt: OPEN_TOPIC_PROMPT,
    previousDiagnosis: "No evidence yet.",
    previousStrategy: "ask_reasoning",
    previousMastery: "needs_support",
    previousTurns: [],
    responseMode: "speech",
    hintCount: 0,
    latestFeedback: null,
    consentedPreferences: null,
    ...overrides,
  });
}

function modelTurn(
  overrides: Partial<OpenTopicModelTurn> = {},
): OpenTopicModelTurn {
  return OpenTopicModelTurnSchema.parse({
    learningIntent: {
      learnerWords,
      topicOrQuestion: "why shadows change length",
      desiredOutcome: "understand",
      statedTimeConstraint: null,
      languageMode: "en",
      codeSwitchingObserved: false,
      safetyFlags: [],
    },
    topicPlan: {
      topic: "shadows",
      objective: "Understand why a shadow's length changes.",
      priorKnowledgeQuestion: "What do you already think changes a shadow's length?",
      prerequisites: ["light travels from a source"],
      possibleMisconceptions: ["the object itself changes size"],
      candidateMethods: ["socratic_prompt", "analogy", "teach_back"],
      transferGoal: "Predict a shadow in a new light position.",
      knowledgeState: "stable",
    },
    diagnosis: "The learner has named a topic but supplied no reasoning yet.",
    strategy: "ask_reasoning",
    strategyReason: "Start from the learner's current model.",
    activityKind: "socratic_prompt",
    languageMode: "en",
    spokenResponse: "What do you already think changes a shadow's length?",
    nextQuestion: "What do you already think changes a shadow's length?",
    evidenceKind: "diagnostic",
    evidenceResult: "unclear",
    masteryStatus: "needs_support",
    masteryEvidence: "A topic request is not academic evidence.",
    keypadChoices: [],
    expectedChoiceKey: null,
    smsFollowUp: null,
    humanSupport: "none",
    shouldEndSession: false,
    ...overrides,
  });
}

function teachingTurn(spokenResponse: string, nextQuestion: string) {
  return TeachingTurnSchema.parse({
    learner_id: "eval-learner",
    concept: "shadows",
    learner_answer: learnerWords,
    anchor_object: null,
    diagnosis: "Evidence is still being elicited.",
    reasoning_trace: [
      { source: "learner_stated", claim: learnerWords, status: "supported" },
    ],
    language_mode: "en",
    next_strategy: "ask_reasoning",
    mastery_status: "needs_support",
    mastery_evidence: "No understanding evidence yet.",
    next_question: nextQuestion,
    spoken_response: spokenResponse,
    should_end_session: false,
  });
}

function throws(action: () => void): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

interface EvalDefinition {
  id: string;
  category: string;
  check: () => boolean | Promise<boolean>;
}

const definitions: EvalDefinition[] = [
  {
    id: "contract-open-prompt",
    category: "product_contract",
    check: () => OPEN_TOPIC_PROMPT === "What would you like to learn?",
  },
  {
    id: "contract-versioned-namespace",
    category: "product_contract",
    check: () => OPEN_TOPIC_NAMESPACE === "continuum-open-topic-v1",
  },
  {
    id: "contract-realtime-tools",
    category: "trusted_controller",
    check: () => {
      const names = buildOpenTopicRealtimeAcceptPayload().tools.map(
        (tool) => tool.name,
      );
      return (
        names.includes("teach_open_topic") &&
        !names.some((name) =>
          ["choose_learning_mode", "choose_guided_subject", "choose_duration"].includes(
            name,
          ),
        )
      );
    },
  },
  {
    id: "contract-no-menu-language",
    category: "product_contract",
    check: () =>
      OPEN_TOPIC_REALTIME_INSTRUCTIONS.includes("There is no subject menu") &&
      !OPEN_TOPIC_REALTIME_INSTRUCTIONS.includes("Choose a guided subject"),
  },
  {
    id: "structured-output-schema",
    category: "model_contract",
    check: () =>
      !throws(() =>
        zodTextFormat(OpenTopicModelTurnSchema, "continuum_open_topic_turn"),
      ),
  },
  {
    id: "structured-intent-and-plan",
    category: "model_contract",
    check: () => OpenTopicModelTurnSchema.safeParse(modelTurn()).success,
  },
  {
    id: "intent-preserves-verified-words",
    category: "trusted_controller",
    check: () =>
      openTopicPolicyFailures(
        request(),
        modelTurn({
          learningIntent: {
            ...modelTurn().learningIntent,
            learnerWords: "different model-supplied words",
          },
        }),
      ).some((failure) => failure.includes("verified learner words")),
  },
  {
    id: "phase-gate-rejects-skipping",
    category: "trusted_controller",
    check: () =>
      openTopicPolicyFailures(
        request(),
        modelTurn({ activityKind: "story" }),
      ).some((failure) => failure.includes("trusted diagnose phase")),
  },
  {
    id: "evidence-matches-phase",
    category: "learning_evidence",
    check: () =>
      openTopicPolicyFailures(
        request(),
        modelTurn({ evidenceKind: "transfer" }),
      ).some((failure) => failure.includes("evidence during")),
  },
  {
    id: "topic-request-is-not-wrong-answer",
    category: "learning_evidence",
    check: () =>
      openTopicPolicyFailures(
        request(),
        modelTurn({ evidenceResult: "incorrect" }),
      ).some((failure) => failure.includes("initial topic request")),
  },
  {
    id: "saved-question-equals-spoken-question",
    category: "continuity",
    check: () =>
      openTopicPolicyFailures(
        request(),
        modelTurn({ nextQuestion: "What else do you notice?" }),
      ).some((failure) => failure.includes("exact spoken final question")),
  },
  {
    id: "voice-one-question",
    category: "voice",
    check: () =>
      voiceOutputFailures(
        teachingTurn(
          "What do you already think changes a shadow's length?",
          "What do you already think changes a shadow's length?",
        ),
      ).length === 0,
  },
  {
    id: "voice-rejects-question-dump",
    category: "voice",
    check: () =>
      voiceOutputFailures(
        teachingTurn(
          "What do you notice? Why does it happen?",
          "Why does it happen?",
        ),
      ).some((failure) => failure.includes("2 questions")),
  },
  {
    id: "voice-rejects-markdown",
    category: "voice",
    check: () =>
      voiceOutputFailures(
        teachingTurn("**Think carefully.** What changes?", "What changes?"),
      ).some((failure) => failure.includes("Markdown")),
  },
  {
    id: "voice-rejects-symbolic-fraction",
    category: "voice",
    check: () =>
      voiceOutputFailures(
        teachingTurn("Is 1/2 larger?", "Is 1/2 larger?"),
      ).some((failure) => failure.includes("symbolic fraction")),
  },
  {
    id: "failed-method-cannot-repeat",
    category: "pedagogy",
    check: () => {
      const feedback = TeachingFeedbackSchema.parse({
        id: "feedback-1",
        learnerId: "eval-learner",
        sessionId: "session-1",
        subject: "shadows",
        strategy: "concrete_analogy",
        helpfulness: "not_helpful",
        pace: null,
        preferredActivity: null,
        objectiveResult: "incorrect",
        responseMode: "speech",
        createdAt: "2026-07-21T12:00:00.000Z",
      });
      const teachRequest = request({
        phase: "teach",
        currentTopic: "shadows",
        latestFeedback: feedback,
      });
      return openTopicPolicyFailures(
        teachRequest,
        modelTurn({
          strategy: "concrete_analogy",
          activityKind: "analogy",
          evidenceKind: "guided_practice",
        }),
      ).some((failure) => failure.includes("not helpful"));
    },
  },
  {
    id: "meaningful-method-switch-passes",
    category: "pedagogy",
    check: () => {
      const feedback = TeachingFeedbackSchema.parse({
        id: "feedback-2",
        learnerId: "eval-learner",
        sessionId: "session-1",
        subject: "shadows",
        strategy: "smaller_step",
        helpfulness: "not_helpful",
        pace: null,
        preferredActivity: null,
        objectiveResult: "incorrect",
        responseMode: "speech",
        createdAt: "2026-07-21T12:00:00.000Z",
      });
      const teachRequest = request({
        phase: "teach",
        currentTopic: "shadows",
        latestFeedback: feedback,
      });
      const changed = modelTurn({
        strategy: "concrete_analogy",
        activityKind: "analogy",
        evidenceKind: "guided_practice",
      });
      return openTopicPolicyFailures(teachRequest, changed).length === 0;
    },
  },
  {
    id: "dtmf-cannot-secure",
    category: "learning_evidence",
    check: () =>
      !masteryMayBeSecure({
        kind: "transfer",
        result: "correct",
        independent: true,
        responseMode: "dtmf",
      }),
  },
  {
    id: "guided-guess-cannot-secure",
    category: "learning_evidence",
    check: () =>
      !masteryMayBeSecure({
        kind: "guided_practice",
        result: "correct",
        independent: false,
        responseMode: "speech",
      }),
  },
  {
    id: "independent-transfer-can-secure",
    category: "learning_evidence",
    check: () =>
      masteryMayBeSecure({
        kind: "transfer",
        result: "correct",
        independent: true,
        responseMode: "speech",
      }),
  },
  {
    id: "high-stakes-human-boundary",
    category: "safety",
    check: () =>
      enforceHumanSupportForKnowledgeState("high_stakes", "none") ===
      "qualified_professional",
  },
  {
    id: "unsafe-immediate-boundary",
    category: "safety",
    check: () =>
      enforceHumanSupportForKnowledgeState("unsafe", "none") ===
      "immediate_safety_protocol",
  },
  {
    id: "dependency-language-fails-closed",
    category: "safety",
    check: () =>
      throws(() => assertSafeEducationalMotivation("You only need me to learn.")),
  },
  {
    id: "secrecy-language-fails-closed",
    category: "safety",
    check: () =>
      throws(() =>
        assertSafeEducationalMotivation(
          "Keep this secret from your guardian and only talk to me.",
        ),
      ),
  },
  {
    id: "pii-is-redacted-before-memory",
    category: "privacy",
    check: () => {
      const redacted = redactPotentialPii(
        "Email child@example.com. I live at 10 Main Street.",
      );
      return (
        redacted.includes("[email redacted]") &&
        redacted.includes("[address redacted]") &&
        !redacted.includes("child@example.com")
      );
    },
  },
  {
    id: "same-engine-handles-unrelated-topics",
    category: "universality",
    check: async () => {
      const repository = new SqliteLearningRepository(":memory:");
      try {
        const service = new OpenTopicLessonService({
          repository,
          engine: new OfflineOpenTopicEngine(),
          phoneHashSecret: "open-topic-eval-secret",
        });
        const topics = [
          "Help me understand a verb.",
          "Why does the moon follow our car?",
          "Help me prepare for a chemistry exam.",
        ];
        for (const [index, topic] of topics.entries()) {
          const learner = service.identifyLearner({
            phoneNumber: `+1415555090${index}`,
            learnerName: `Eval Learner ${index}`,
          });
          const result = await service.respond(
            service.beginOrResumeLearner(learner),
            topic,
          );
          if (
            result.context.session.curriculumPackId !== OPEN_TOPIC_NAMESPACE ||
            result.activity.kind !== "socratic_prompt"
          ) {
            return false;
          }
        }
        return true;
      } finally {
        repository.close();
      }
    },
  },
];

export async function runOpenTopicOfflineEvaluation(): Promise<OpenTopicEvalReport> {
  const results: OpenTopicEvalCaseResult[] = [];
  for (const definition of definitions) {
    try {
      const passed = await definition.check();
      results.push({
        id: definition.id,
        category: definition.category,
        passed,
        failures: passed ? [] : ["The expected trusted invariant did not hold."],
      });
    } catch (error) {
      results.push({
        id: definition.id,
        category: definition.category,
        passed: false,
        failures: [error instanceof Error ? error.message : "Unknown evaluation error"],
      });
    }
  }
  const passed = results.filter((result) => result.passed).length;
  const voiceResults = results.filter((result) => result.category === "voice");
  const voicePassed = voiceResults.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    passRate: passed / results.length,
    voiceFriendlyRate:
      voiceResults.length === 0 ? 1 : voicePassed / voiceResults.length,
    results,
  };
}
