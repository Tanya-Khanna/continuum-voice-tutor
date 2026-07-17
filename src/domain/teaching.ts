import { z } from "zod";

export const LanguageTagSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(
    /^[a-z]{2,8}(?:-[A-Za-z0-9]{1,8})*(?:\+[a-z]{2,8}(?:-[A-Za-z0-9]{1,8})*)*$/u,
    "Use one or more BCP-47-style language tags joined with + for code-switching.",
  );

export const LanguageModeSchema = z.union([
  z.literal("auto"),
  LanguageTagSchema,
]);

export const ResolvedLanguageModeSchema = LanguageTagSchema;

export const MasteryStatusSchema = z.enum([
  "needs_support",
  "developing",
  "secure",
]);

export const TeachingStrategySchema = z.enum([
  "ask_reasoning",
  "concrete_analogy",
  "contrast_cases",
  "smaller_step",
  "retrieval_practice",
  "recap",
  "safety_redirect",
  "uncertainty",
]);

export const LessonPhaseSchema = z.enum(["explore", "check", "recap"]);

export const TeachingLessonStateSchema = z.object({
  turnNumber: z.number().int().positive(),
  targetTurns: z.number().int().positive(),
  phase: LessonPhaseSchema,
  previousPrompt: z.string().min(1),
  previousDiagnosis: z.string(),
  priorReasoningEvidenceCount: z.number().int().nonnegative(),
  consecutiveSafetyRedirects: z.number().int().nonnegative(),
});

export const TeachingRequestSchema = z.object({
  learnerId: z.string().min(1),
  concept: z.string().min(1),
  learnerAnswer: z.string().max(2_000),
  requestedLanguageMode: LanguageModeSchema.default("auto"),
  lessonState: TeachingLessonStateSchema.optional(),
});

export const TeachingTurnSchema = z.object({
  learner_id: z.string().min(1),
  concept: z.string().min(1),
  learner_answer: z.string(),
  diagnosis: z.string().min(1),
  language_mode: ResolvedLanguageModeSchema,
  next_strategy: TeachingStrategySchema,
  mastery_status: MasteryStatusSchema,
  mastery_evidence: z.string(),
  next_question: z.string().min(1),
  spoken_response: z.string().min(1),
  should_end_session: z.boolean(),
});

export type LanguageMode = z.infer<typeof LanguageModeSchema>;
export type LessonPhase = z.infer<typeof LessonPhaseSchema>;
export type TeachingRequest = z.infer<typeof TeachingRequestSchema>;
export type TeachingTurn = z.infer<typeof TeachingTurnSchema>;
