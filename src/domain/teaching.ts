import { z } from "zod";

export const LanguageModeSchema = z.enum([
  "en",
  "hi",
  "hinglish",
  "auto",
  "other",
]);

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

export const TeachingRequestSchema = z.object({
  learnerId: z.string().min(1),
  concept: z.string().min(1).default("comparing_unit_fractions"),
  learnerAnswer: z.string().max(2_000),
  requestedLanguageMode: LanguageModeSchema.default("auto"),
});

export const TeachingTurnSchema = z.object({
  learner_id: z.string().min(1),
  concept: z.string().min(1),
  learner_answer: z.string(),
  diagnosis: z.string().min(1),
  language_mode: LanguageModeSchema.exclude(["auto"]),
  next_strategy: TeachingStrategySchema,
  mastery_status: MasteryStatusSchema,
  mastery_evidence: z.string(),
  next_question: z.string().min(1),
  spoken_response: z.string().min(1),
  should_end_session: z.boolean(),
});

export type LanguageMode = z.infer<typeof LanguageModeSchema>;
export type TeachingRequest = z.infer<typeof TeachingRequestSchema>;
export type TeachingTurn = z.infer<typeof TeachingTurnSchema>;
