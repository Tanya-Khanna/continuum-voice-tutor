import { z } from "zod";

export const LearningActivityKindSchema = z.enum([
  "explanation",
  "socratic_prompt",
  "analogy",
  "story",
  "worked_example",
  "hint",
  "quiz",
  "flashcard",
  "teach_back",
  "retrieval",
  "transfer",
  "homework",
  "reflection",
  "study_plan_step",
  "recap",
]);

export const LearnerResponseModeSchema = z.enum([
  "speech",
  "dtmf",
  "sms",
]);

export const EvidenceKindSchema = z.enum([
  "diagnostic",
  "guided_practice",
  "teach_back",
  "transfer",
  "reflection",
  "homework",
  "retention",
]);

export const EvidenceResultSchema = z.enum([
  "correct",
  "partial",
  "incorrect",
  "unclear",
]);

export const HumanSupportDecisionSchema = z.enum([
  "none",
  "suggest_guardian",
  "suggest_teacher",
  "curriculum_review",
  "safety_protocol",
  "qualified_professional",
  "immediate_safety_protocol",
]);

export const TeachingHelpfulnessSchema = z.enum([
  "helpful",
  "not_helpful",
  "unsure",
]);

export const TeachingPaceSchema = z.enum([
  "too_fast",
  "right",
  "too_slow",
]);

export const KeypadChoiceSchema = z.object({
  key: z.enum(["1", "2", "3", "4"]),
  label: z.string().trim().min(1).max(120),
  reviewedAnswerId: z.string().trim().min(1).max(120).nullable().default(null),
});

export const LearningActivitySchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: LearningActivityKindSchema,
  objective: z.string().trim().min(1).max(500),
  voiceScript: z.string().trim().min(1).max(1_200),
  expectedResponse: z.enum(["none", "open_speech", "choice", "reflection"]),
  reviewedQuestionId: z.string().trim().min(1).max(120).nullable().default(null),
  keypadChoices: z.array(KeypadChoiceSchema).max(4).default([]),
  smsText: z.string().trim().min(1).max(160).nullable().default(null),
  estimatedSeconds: z.number().int().min(3).max(600),
  canCreateMasteryEvidence: z.boolean(),
});

export const TeachingFeedbackSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  sessionId: z.string().min(1),
  subject: z.string().trim().min(1).max(120),
  strategy: z.string().trim().min(1).max(120),
  helpfulness: TeachingHelpfulnessSchema,
  pace: TeachingPaceSchema.nullable().default(null),
  preferredActivity: LearningActivityKindSchema.nullable().default(null),
  objectiveResult: EvidenceResultSchema,
  responseMode: LearnerResponseModeSchema,
  createdAt: z.string().datetime(),
});

export const LearningEvidenceSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  sessionId: z.string().min(1),
  curriculumPackId: z.string().min(1),
  concept: z.string().min(1),
  activityId: z.string().min(1),
  kind: EvidenceKindSchema,
  result: EvidenceResultSchema,
  independent: z.boolean(),
  responseMode: LearnerResponseModeSchema,
  reasoningEvidence: z.string().max(1_000),
  strategy: z.string().min(1),
  hintCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const LearnerEducationProfileSchema = z.object({
  learnerId: z.string().min(1),
  ageBand: z.enum(["under_8", "8_10", "11_13", "14_17", "adult", "unknown"]),
  reportedGrade: z.number().int().min(1).max(16).nullable(),
  interests: z.array(z.string().trim().min(1).max(80)).max(12),
  aspirations: z.array(z.string().trim().min(1).max(120)).max(6),
  curiosityTopics: z.array(z.string().trim().min(1).max(120)).max(20),
  preferredExamples: z.array(z.string().trim().min(1).max(80)).max(12),
  learningGoals: z.array(z.string().trim().min(1).max(160)).max(10),
  preferredActivities: z.array(LearningActivityKindSchema).max(8),
  preferredPace: TeachingPaceSchema.nullable(),
  consentedFields: z.array(
    z.enum([
      "age_band",
      "reported_grade",
      "interests",
      "aspirations",
      "curiosity_topics",
      "preferred_examples",
      "learning_goals",
      "preferred_activities",
      "preferred_pace",
    ]),
  ),
  updatedAt: z.string().datetime(),
});

export const CuriosityTrailSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  sessionId: z.string().min(1),
  originalQuestion: z.string().trim().min(1).max(2_000),
  summary: z.string().trim().min(1).max(1_000),
  relatedQuestions: z.array(z.string().trim().min(1).max(300)).max(8),
  flashcards: z.array(z.string().trim().min(1).max(300)).max(8),
  suggestedNextCallAt: z.string().datetime().nullable(),
  relatedCurriculumPackId: z.string().min(1).nullable(),
  relatedConceptId: z.string().min(1).nullable(),
  learnerApproved: z.boolean(),
  safetyStatus: z.enum(["safe", "redirect"]),
  certainty: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PedagogyDecisionSchema = z.object({
  learnerId: z.string().min(1),
  sessionId: z.string().min(1),
  curriculumPackId: z.string().min(1),
  concept: z.string().min(1),
  activity: LearningActivitySchema,
  diagnosis: z.string().min(1),
  strategy: z.string().min(1),
  strategyReason: z.string().min(1),
  strategyChanged: z.boolean(),
  evidenceKind: EvidenceKindSchema,
  evidenceResult: EvidenceResultSchema,
  independentEvidence: z.boolean(),
  responseMode: LearnerResponseModeSchema,
  humanSupport: HumanSupportDecisionSchema,
  reviewAfterDays: z.number().int().min(1).max(365).nullable(),
  openTopicPlan: z.unknown().nullable().optional(),
  learningIntent: z.unknown().nullable().optional(),
  knowledgeState: z
    .enum([
      "stable",
      "ambiguous",
      "current_or_disputed",
      "high_stakes",
      "unsafe",
    ])
    .nullable()
    .optional(),
  expectedChoiceKey: z.enum(["1", "2", "3", "4"]).nullable().optional(),
  smsFollowUp: z.string().trim().min(1).max(160).nullable().optional(),
  createdAt: z.string().datetime(),
});

export const LessonDurationMinutesSchema = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(10),
]);

export function masteryMayBeSecure(evidence: {
  kind: z.infer<typeof EvidenceKindSchema>;
  result: z.infer<typeof EvidenceResultSchema>;
  independent: boolean;
  responseMode: z.infer<typeof LearnerResponseModeSchema>;
}): boolean {
  return (
    (evidence.kind === "transfer" || evidence.kind === "retention") &&
    evidence.result === "correct" &&
    evidence.independent &&
    evidence.responseMode !== "dtmf"
  );
}

export function nextReviewAfterDays(evidence: {
  result: z.infer<typeof EvidenceResultSchema>;
  masteryStatus: "needs_support" | "developing" | "secure";
}): 1 | 3 | 7 {
  if (evidence.result === "incorrect" || evidence.masteryStatus === "needs_support") {
    return 1;
  }
  return evidence.masteryStatus === "secure" ? 7 : 3;
}

export function activityKindForStrategy(options: {
  strategy: string;
  phase: "explore" | "check" | "reflect" | "recap";
  hasMisconception: boolean;
}): z.infer<typeof LearningActivityKindSchema> {
  if (options.phase === "recap") return "recap";
  if (options.phase === "reflect") return "reflection";
  if (options.phase === "check") return "transfer";
  if (options.strategy === "concrete_analogy") return "analogy";
  if (options.strategy === "contrast_cases") return "quiz";
  if (options.strategy === "smaller_step") return "hint";
  if (options.strategy === "retrieval_practice") return "retrieval";
  if (options.strategy === "story") return "story";
  if (options.strategy === "worked_example") return "worked_example";
  if (options.strategy === "hint_ladder") return "hint";
  if (options.strategy === "teach_back") return "teach_back";
  if (options.strategy === "reflection") return "reflection";
  return options.hasMisconception ? "explanation" : "socratic_prompt";
}

export function humanSupportDecisionFor(options: {
  immediateSafetyConcern: boolean;
  highStakesQuestion: boolean;
  accommodationRequested: boolean;
  curriculumReviewNeeded: boolean;
  distinctFailedStrategies: number;
}): z.infer<typeof HumanSupportDecisionSchema> {
  if (options.immediateSafetyConcern || options.highStakesQuestion) {
    return "safety_protocol";
  }
  if (options.curriculumReviewNeeded) return "curriculum_review";
  if (options.accommodationRequested) return "suggest_guardian";
  if (options.distinctFailedStrategies >= 3) return "suggest_teacher";
  return "none";
}

export function assertSafeEducationalMotivation(spokenResponse: string): void {
  const prohibited = [
    /(?:i am|i'm) your (?:best |only )?friend/iu,
    /only (?:i|continuum) (?:understand|care)/iu,
    /you need me/iu,
    /do not leave me|don't leave me/iu,
    /guarantee(?:s|d)? (?:your|that you|a) /iu,
    /this lesson will make you (?:a|an) /iu,
    /you will definitely become/iu,
    /keep (?:this|it) secret (?:from|between)/iu,
    /do not tell (?:your|any) (?:parent|guardian|teacher)|don't tell (?:your|any) (?:parent|guardian|teacher)/iu,
    /you only need me|i(?:'m| am) all you need/iu,
    /i love you|be my (?:girlfriend|boyfriend|partner)/iu,
  ];
  if (prohibited.some((pattern) => pattern.test(spokenResponse))) {
    throw new Error(
      "Teaching policy violation: manipulative dependency or career-guarantee language.",
    );
  }
}

export type LearningActivity = z.infer<typeof LearningActivitySchema>;
export type LearningEvidence = z.infer<typeof LearningEvidenceSchema>;
export type TeachingFeedback = z.infer<typeof TeachingFeedbackSchema>;
export type LearnerEducationProfile = z.infer<typeof LearnerEducationProfileSchema>;
export type CuriosityTrail = z.infer<typeof CuriosityTrailSchema>;
export type PedagogyDecision = z.infer<typeof PedagogyDecisionSchema>;
