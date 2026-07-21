import { z } from "zod";
import {
  EvidenceKindSchema,
  EvidenceResultSchema,
  HumanSupportDecisionSchema,
  KeypadChoiceSchema,
  LearnerResponseModeSchema,
  LearningActivityKindSchema,
  TeachingFeedbackSchema,
} from "./classroom.js";
import {
  LanguageModeSchema,
  MasteryStatusSchema,
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
} from "./teaching.js";

export const OPEN_TOPIC_NAMESPACE = "continuum-open-topic-v1";
export const OPEN_TOPIC_PLACEHOLDER = "open-topic";
export const OPEN_TOPIC_PROMPT = "What would you like to learn?";

export const OpenTopicPhaseSchema = z.enum([
  "diagnose",
  "teach",
  "practice",
  "teach_back",
  "transfer",
  "reflect",
  "recap",
]);

export const KnowledgeStateSchema = z.enum([
  "stable",
  "ambiguous",
  "current_or_disputed",
  "high_stakes",
  "unsafe",
]);

export const LearningIntentSchema = z.object({
  learnerWords: z.string().trim().min(1).max(1_000),
  topicOrQuestion: z.string().trim().min(1).max(240),
  desiredOutcome: z.enum([
    "understand",
    "solve",
    "review",
    "prepare",
    "explore",
  ]),
  statedTimeConstraint: z.string().trim().min(1).max(160).nullable(),
  languageMode: ResolvedLanguageModeSchema,
  codeSwitchingObserved: z.boolean(),
  safetyFlags: z
    .array(
      z.enum([
        "current_or_disputed",
        "medical",
        "legal",
        "financial",
        "crisis",
        "abuse",
        "immediate_danger",
        "unsafe_request",
      ]),
    )
    .max(4),
});

export const OpenTopicPlanSchema = z.object({
  topic: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(400),
  priorKnowledgeQuestion: z.string().trim().min(1).max(400),
  prerequisites: z.array(z.string().trim().min(1).max(160)).max(6),
  possibleMisconceptions: z.array(z.string().trim().min(1).max(220)).max(6),
  candidateMethods: z.array(LearningActivityKindSchema).min(1).max(6),
  transferGoal: z.string().trim().min(1).max(300),
  knowledgeState: KnowledgeStateSchema,
});

export const OpenTopicHistoryEntrySchema = z.object({
  learnerInput: z.string().max(1_000),
  diagnosis: z.string().max(600),
  strategy: TeachingStrategySchema,
  masteryStatus: MasteryStatusSchema,
  masteryEvidence: z.string().max(1_000),
  nextQuestion: z.string().max(500),
});

export const OpenTopicRequestSchema = z.object({
  learnerId: z.string().min(1),
  learnerInput: z.string().trim().min(1).max(2_000),
  requestedLanguageMode: LanguageModeSchema.default("auto"),
  phase: OpenTopicPhaseSchema,
  currentTopic: z.string().trim().min(1).max(160).nullable(),
  previousPrompt: z.string().trim().min(1).max(1_000),
  previousDiagnosis: z.string().max(1_000),
  previousStrategy: TeachingStrategySchema,
  previousMastery: MasteryStatusSchema,
  previousTurns: z.array(OpenTopicHistoryEntrySchema).max(8),
  priorLearningMemory: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(240),
        summary: z.string().trim().min(1).max(1_000),
        legacy: z.literal(true),
      }),
    )
    .max(5)
    .default([]),
  responseMode: LearnerResponseModeSchema,
  hintCount: z.number().int().nonnegative().max(20),
  latestFeedback: TeachingFeedbackSchema.nullable(),
  consentedPreferences: z
    .object({
      preferredExamples: z.array(z.string().trim().min(1).max(80)).max(12),
      learningGoals: z.array(z.string().trim().min(1).max(160)).max(10),
      preferredActivities: z.array(LearningActivityKindSchema).max(8),
      preferredPace: z.enum(["too_fast", "right", "too_slow"]).nullable(),
    })
    .nullable(),
});

export const OpenTopicModelTurnSchema = z
  .object({
    learningIntent: LearningIntentSchema,
    topicPlan: OpenTopicPlanSchema,
    diagnosis: z.string().trim().min(1).max(1_000),
    diagnosisBasis: z.enum([
      "no_evidence",
      "learner_words",
      "learner_reasoning",
      "prior_learning_evidence",
    ]),
    misconception: z.string().trim().min(1).max(500).nullable(),
    strategy: TeachingStrategySchema,
    strategyReason: z.string().trim().min(1).max(800),
    activityKind: LearningActivityKindSchema,
    languageMode: ResolvedLanguageModeSchema,
    spokenResponse: z.string().trim().min(1).max(1_200),
    nextQuestion: z.string().trim().min(1).max(500),
    evidenceKind: EvidenceKindSchema,
    evidenceResult: EvidenceResultSchema,
    masteryStatus: MasteryStatusSchema,
    masteryEvidence: z.string().max(1_000),
    keypadChoices: z.array(KeypadChoiceSchema).max(4),
    expectedChoiceKey: z.enum(["1", "2", "3", "4"]).nullable(),
    smsFollowUp: z.string().trim().min(1).max(160).nullable(),
    humanSupport: HumanSupportDecisionSchema,
    shouldEndSession: z.boolean(),
  })
  .superRefine((turn, context) => {
    if (
      turn.expectedChoiceKey !== null &&
      !turn.keypadChoices.some(
        (choice) => choice.key === turn.expectedChoiceKey,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedChoiceKey"],
        message: "The expected keypad key must exist in keypadChoices.",
      });
    }
    if (turn.keypadChoices.length > 0 && turn.keypadChoices.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["keypadChoices"],
        message: "A keypad activity needs at least two choices.",
      });
    }
    if (turn.shouldEndSession && turn.activityKind !== "recap") {
      context.addIssue({
        code: "custom",
        path: ["shouldEndSession"],
        message: "Only a recap may normally end an open-topic lesson.",
      });
    }
  });

export type OpenTopicPhase = z.infer<typeof OpenTopicPhaseSchema>;
export type KnowledgeState = z.infer<typeof KnowledgeStateSchema>;
export type LearningIntent = z.infer<typeof LearningIntentSchema>;
export type OpenTopicPlan = z.infer<typeof OpenTopicPlanSchema>;
export type OpenTopicRequest = z.infer<typeof OpenTopicRequestSchema>;
export type OpenTopicModelTurn = z.infer<typeof OpenTopicModelTurnSchema>;

export function nextOpenTopicPhase(options: {
  turnCount: number;
  previousStrategy: z.infer<typeof TeachingStrategySchema>;
  previousMastery: z.infer<typeof MasteryStatusSchema>;
  latestFeedback: z.infer<typeof TeachingFeedbackSchema> | null;
}): OpenTopicPhase {
  if (options.turnCount === 0) return "diagnose";
  if (options.previousStrategy === "reflection") return "recap";
  if (options.previousStrategy === "transfer") return "reflect";
  if (options.latestFeedback?.helpfulness === "not_helpful") return "teach";
  if (options.previousMastery === "secure") return "reflect";
  if (options.previousStrategy === "teach_back") return "transfer";
  if (options.previousMastery === "developing") return "teach_back";
  if (options.turnCount === 1) return "teach";
  return "practice";
}

export function evidenceKindForOpenTopicPhase(
  phase: OpenTopicPhase,
): z.infer<typeof EvidenceKindSchema> {
  if (phase === "diagnose") return "diagnostic";
  if (phase === "teach_back") return "teach_back";
  if (phase === "transfer") return "transfer";
  if (phase === "reflect" || phase === "recap") return "reflection";
  return "guided_practice";
}

export function openTopicPolicyFailures(
  request: OpenTopicRequest,
  turn: OpenTopicModelTurn,
): string[] {
  const failures: string[] = [];
  if (turn.learningIntent.learnerWords !== request.learnerInput) {
    failures.push("learningIntent did not preserve the verified learner words");
  }
  const expectedEvidence = evidenceKindForOpenTopicPhase(request.phase);
  if (turn.evidenceKind !== expectedEvidence) {
    failures.push(
      `used ${turn.evidenceKind} evidence during the trusted ${request.phase} phase`,
    );
  }
  const normalActivities: Record<
    OpenTopicPhase,
    ReadonlySet<z.infer<typeof LearningActivityKindSchema>>
  > = {
    diagnose: new Set(["socratic_prompt"]),
    teach: new Set(["explanation", "analogy", "story", "worked_example", "hint"]),
    practice: new Set(["quiz", "hint", "socratic_prompt", "retrieval"]),
    teach_back: new Set(["teach_back"]),
    transfer: new Set(["transfer"]),
    reflect: new Set(["reflection"]),
    recap: new Set(["recap"]),
  };
  const safetyBoundary =
    turn.topicPlan.knowledgeState === "high_stakes" ||
    turn.topicPlan.knowledgeState === "unsafe" ||
    turn.humanSupport !== "none";
  if (
    !normalActivities[request.phase].has(turn.activityKind) &&
    !(safetyBoundary && ["explanation", "socratic_prompt"].includes(turn.activityKind))
  ) {
    failures.push(
      `used ${turn.activityKind} during the trusted ${request.phase} phase`,
    );
  }
  if (request.phase === "diagnose" && turn.evidenceResult !== "unclear") {
    failures.push("treated the initial topic request as academic evidence");
  }
  if (
    request.phase === "diagnose" &&
    (turn.diagnosisBasis !== "no_evidence" || turn.misconception !== null)
  ) {
    failures.push("diagnosed a misconception before learner reasoning existed");
  }
  if (
    turn.misconception !== null &&
    !["learner_reasoning", "prior_learning_evidence"].includes(
      turn.diagnosisBasis,
    )
  ) {
    failures.push("recorded a misconception without reasoning evidence");
  }
  if (
    turn.topicPlan.knowledgeState !== "stable" &&
    turn.masteryStatus === "secure"
  ) {
    failures.push("awarded secure understanding for unstable knowledge");
  }
  const safetyFlags = new Set(turn.learningIntent.safetyFlags);
  if (
    ["abuse", "immediate_danger", "unsafe_request"].some((flag) =>
      safetyFlags.has(
        flag as "abuse" | "immediate_danger" | "unsafe_request",
      ),
    ) &&
    turn.topicPlan.knowledgeState !== "unsafe"
  ) {
    failures.push("did not route an unsafe learner signal to the unsafe boundary");
  }
  if (
    ["medical", "legal", "financial", "crisis"].some((flag) =>
      safetyFlags.has(flag as "medical" | "legal" | "financial" | "crisis"),
    ) &&
    !["high_stakes", "unsafe"].includes(turn.topicPlan.knowledgeState)
  ) {
    failures.push("did not route a high-stakes learner signal to a safety boundary");
  }
  if (
    safetyFlags.has("current_or_disputed") &&
    turn.topicPlan.knowledgeState === "stable"
  ) {
    failures.push("treated a current or disputed learner signal as stable knowledge");
  }
  if (
    request.latestFeedback?.helpfulness === "not_helpful" &&
    turn.strategy === request.latestFeedback.strategy &&
    turn.strategy !== "safety_redirect"
  ) {
    failures.push(
      `repeated ${turn.strategy} after the learner marked it not helpful`,
    );
  }
  if (request.phase === "recap") {
    if (turn.activityKind !== "recap" || !turn.shouldEndSession) {
      failures.push("did not produce a completed recap for the trusted recap phase");
    }
  } else if (!turn.spokenResponse.trim().endsWith(turn.nextQuestion.trim())) {
    failures.push("the saved next question was not the exact spoken final question");
  }
  return failures;
}

export function enforceHumanSupportForKnowledgeState(
  knowledgeState: KnowledgeState,
  proposed: z.infer<typeof HumanSupportDecisionSchema>,
): z.infer<typeof HumanSupportDecisionSchema> {
  if (knowledgeState === "unsafe") return "immediate_safety_protocol";
  if (knowledgeState === "high_stakes") return "qualified_professional";
  return proposed;
}
