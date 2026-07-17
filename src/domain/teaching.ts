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

export const AnchorObjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(80);

export const ReviewedAnchorObjectSchema = AnchorObjectSchema.regex(
  /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\-]{0,79}$/u,
  "Anchor objects must be short noun phrases without contact or address punctuation.",
);

export const TeachingLessonStateSchema = z.object({
  turnNumber: z.number().int().positive(),
  targetTurns: z.number().int().positive(),
  phase: LessonPhaseSchema,
  previousPrompt: z.string().min(1),
  previousDiagnosis: z.string(),
  priorReasoningEvidenceCount: z.number().int().nonnegative(),
  consecutiveSafetyRedirects: z.number().int().nonnegative(),
  anchorObject: AnchorObjectSchema.nullable(),
  placementLevel: z
    .enum(["unplaced", "foundational", "developing", "grade_ready"])
    .default("unplaced"),
});

export const TeachingRequestSchema = z.object({
  learnerId: z.string().min(1),
  concept: z.string().min(1),
  learnerAnswer: z.string().max(2_000),
  requestedLanguageMode: LanguageModeSchema.default("auto"),
  lessonState: TeachingLessonStateSchema.optional(),
});

export const ReasoningTraceEntrySchema = z.object({
  source: z.enum(["learner_stated", "tutor_inference"]),
  claim: z.string().min(1),
  status: z.enum(["supported", "unsupported", "unclear"]),
});

export const TeachingTurnSchema = z.object({
  learner_id: z.string().min(1),
  concept: z.string().min(1),
  learner_answer: z.string(),
  anchor_object: AnchorObjectSchema.nullable(),
  diagnosis: z.string().min(1),
  reasoning_trace: z.array(ReasoningTraceEntrySchema).min(1).max(6),
  language_mode: ResolvedLanguageModeSchema,
  next_strategy: TeachingStrategySchema,
  mastery_status: MasteryStatusSchema,
  mastery_evidence: z.string(),
  next_question: z.string().min(1),
  spoken_response: z.string().min(1),
  should_end_session: z.boolean(),
});

export const PersistedTeachingTurnSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }
  const historical = value as Record<string, unknown>;
  return {
    ...historical,
    ...("anchor_object" in historical ? {} : { anchor_object: null }),
    ...(historical.reasoning_trace
      ? {}
      : {
          reasoning_trace: [
            {
              source: "tutor_inference",
              claim:
                typeof historical.diagnosis === "string" &&
                historical.diagnosis
                  ? historical.diagnosis
                  : "Historical turn recorded before structured reasoning traces.",
              status: "unclear",
            },
          ],
        }),
  };
}, TeachingTurnSchema);

export type LanguageMode = z.infer<typeof LanguageModeSchema>;
export type LessonPhase = z.infer<typeof LessonPhaseSchema>;
export type TeachingRequest = z.infer<typeof TeachingRequestSchema>;
export type TeachingTurn = z.infer<typeof TeachingTurnSchema>;
