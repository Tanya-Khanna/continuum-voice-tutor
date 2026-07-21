import {
  OpenTopicModelTurnSchema,
  OpenTopicRequestSchema,
  type OpenTopicModelTurn,
  type OpenTopicRequest,
} from "../domain/open-topic.js";
import type { ModelResult } from "./teaching-engine.js";
import type { OpenTopicTeachingEngine } from "./open-topic-engine.js";

function requestedLanguage(request: OpenTopicRequest): string {
  return request.requestedLanguageMode === "auto"
    ? "en"
    : request.requestedLanguageMode;
}

function compactTopic(request: OpenTopicRequest): string {
  if (request.currentTopic) return request.currentTopic;
  return request.learnerInput
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

function desiredOutcome(
  learnerInput: string,
): "understand" | "solve" | "review" | "prepare" | "explore" {
  if (/\b(?:exam|test|prepare|preparing)\b/iu.test(learnerInput)) return "prepare";
  if (/\b(?:review|revise|revision)\b/iu.test(learnerInput)) return "review";
  if (/\b(?:solve|equation|problem)\b/iu.test(learnerInput)) return "solve";
  if (/\b(?:why|how|wonder|curious)\b/iu.test(learnerInput)) return "explore";
  return "understand";
}

export class OfflineOpenTopicEngine implements OpenTopicTeachingEngine {
  readonly modelRoute = "offline-open-topic";

  async teachOpenTopic(
    unparsedRequest: OpenTopicRequest,
  ): Promise<ModelResult<OpenTopicModelTurn>> {
    const request = OpenTopicRequestSchema.parse(unparsedRequest);
    const topic = compactTopic(request);
    const plan = {
      topic,
      objective: `Build a clear understanding of ${topic}.`,
      priorKnowledgeQuestion: "What do you already think or understand about it?",
      prerequisites: [],
      possibleMisconceptions: [],
      candidateMethods: ["socratic_prompt", "explanation", "teach_back"],
      transferGoal: `Use the idea behind ${topic} in a new example.`,
      knowledgeState: "stable",
    } as const;

    const common = {
      learningIntent: {
        learnerWords: request.learnerInput,
        topicOrQuestion: topic,
        desiredOutcome: desiredOutcome(request.learnerInput),
        statedTimeConstraint: null,
        languageMode: requestedLanguage(request),
        codeSwitchingObserved: request.requestedLanguageMode.includes("+"),
        safetyFlags: [],
      },
      topicPlan: plan,
      languageMode: requestedLanguage(request),
      keypadChoices: [],
      expectedChoiceKey: null,
      smsFollowUp: null,
      humanSupport: "none",
      shouldEndSession: false,
    } as const;

    const value =
      request.phase === "diagnose"
        ? {
            ...common,
            diagnosis: "No understanding evidence has been collected yet.",
            diagnosisBasis: "no_evidence",
            misconception: null,
            strategy: "ask_reasoning",
            strategyReason: "Begin from the learner's current mental model.",
            activityKind: "socratic_prompt",
            spokenResponse: plan.priorKnowledgeQuestion,
            nextQuestion: plan.priorKnowledgeQuestion,
            evidenceKind: "diagnostic",
            evidenceResult: "unclear",
            masteryStatus: "needs_support",
            masteryEvidence: "The learner supplied a topic, not an answer.",
          }
        : request.phase === "teach_back"
          ? {
              ...common,
              diagnosis: "The learner is ready to state the idea in their own words.",
              diagnosisBasis: "learner_reasoning",
              misconception: null,
              strategy: "teach_back",
              strategyReason: "Teach-back checks meaning rather than recognition.",
              activityKind: "teach_back",
              spokenResponse: "Now use your own words. How would you explain the main idea?",
              nextQuestion: "How would you explain the main idea?",
              evidenceKind: "teach_back",
              evidenceResult: "partial",
              masteryStatus: "developing",
              masteryEvidence: "A teach-back response is still pending.",
            }
          : request.phase === "transfer"
            ? {
                ...common,
                diagnosis: "The learner needs a new application before understanding can be secure.",
                diagnosisBasis: "learner_reasoning",
                misconception: null,
                strategy: "transfer",
                strategyReason: "A new case distinguishes understanding from repetition.",
                activityKind: "transfer",
                spokenResponse: "Think of a different situation where this idea matters. How would you use it there?",
                nextQuestion: "How would you use it there?",
                evidenceKind: "transfer",
                evidenceResult: "partial",
                masteryStatus: "developing",
                masteryEvidence: "Independent transfer is still pending.",
              }
            : request.phase === "reflect"
              ? {
                  ...common,
                  diagnosis: "The learner has reached a reflection checkpoint.",
                  diagnosisBasis: "prior_learning_evidence",
                  misconception: null,
                  strategy: "reflection",
                  strategyReason: "Reflection gives the learner agency over the next step.",
                  activityKind: "reflection",
                  spokenResponse: "You worked through the idea step by step. What feels clearer now?",
                  nextQuestion: "What feels clearer now?",
                  evidenceKind: "reflection",
                  evidenceResult: "partial",
                  masteryStatus: request.previousMastery,
                  masteryEvidence: "The learner's reflection is still pending.",
                }
              : request.phase === "recap"
                ? {
                    ...common,
                    diagnosis: request.previousDiagnosis,
                    diagnosisBasis: "prior_learning_evidence",
                    misconception: null,
                    strategy: "recap",
                    strategyReason: "Close at a coherent checkpoint and save what comes next.",
                    activityKind: "recap",
                    spokenResponse: `We saved where you stopped with ${topic}. Call again whenever you are ready to continue.`,
                    nextQuestion: `What is the main idea you remember about ${topic}?`,
                    evidenceKind: "reflection",
                    evidenceResult: "unclear",
                    masteryStatus: request.previousMastery,
                    masteryEvidence: "No new evidence was collected during recap.",
                    shouldEndSession: true,
                  }
                : {
                    ...common,
                    diagnosis:
                      request.learnerInput.length < 4
                        ? "The learner's evidence is too brief to interpret confidently."
                        : "The learner has offered a starting idea that needs one smaller step.",
                    diagnosisBasis:
                      request.learnerInput.length < 4
                        ? "learner_words"
                        : "learner_reasoning",
                    misconception: null,
                    strategy:
                      request.latestFeedback?.helpfulness === "not_helpful"
                        ? "concrete_analogy"
                        : "smaller_step",
                    strategyReason:
                      request.latestFeedback?.helpfulness === "not_helpful"
                        ? "The learner rejected the prior approach, so use a concrete case instead."
                        : "Use a smaller question before adding more explanation.",
                    activityKind:
                      request.latestFeedback?.helpfulness === "not_helpful"
                        ? "analogy"
                        : "hint",
                    spokenResponse:
                      request.latestFeedback?.helpfulness === "not_helpful"
                        ? "Let's try a concrete case instead. What everyday example could we use to test this idea?"
                        : "Let's take one small step. Which part feels most confusing right now?",
                    nextQuestion:
                      request.latestFeedback?.helpfulness === "not_helpful"
                        ? "What everyday example could we use to test this idea?"
                        : "Which part feels most confusing right now?",
                    evidenceKind: "guided_practice",
                    evidenceResult: "unclear",
                    masteryStatus: "needs_support",
                    masteryEvidence: "The zero-credit adapter does not infer subject correctness.",
                  };

    return { value: OpenTopicModelTurnSchema.parse(value) };
  }
}
