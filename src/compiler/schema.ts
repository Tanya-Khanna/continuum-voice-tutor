import { z } from "zod";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";

export const CurriculumSourceBriefSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  deployment: z.object({
    country: z.string().min(1),
    countryCode: z.string().regex(/^[A-Z]{2}$/u),
    grade: z.number().int().positive(),
    defaultLanguage: ResolvedLanguageModeSchema,
    testedLanguageModes: z.array(ResolvedLanguageModeSchema),
    syllabus: z.string().min(1),
  }),
  sourceMaterials: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        themes: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  requiredConcepts: z.array(z.string().min(1)).min(1),
  localContextNotes: z.array(z.string().min(1)).default([]),
  originalityRequirements: z.array(z.string().min(1)).min(1),
});

export const CurriculumVerificationSchema = z.object({
  approved: z.boolean(),
  checks: z.object({
    source_grounded: z.boolean(),
    original_wording: z.boolean(),
    schema_complete: z.boolean(),
    voice_friendly: z.boolean(),
    answers_consistent: z.boolean(),
    no_unreviewed_scope: z.boolean(),
  }),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning"]),
      code: z.string().min(1),
      message: z.string().min(1),
      conceptId: z.string().min(1).optional(),
    }),
  ),
});

export type CurriculumSourceBrief = z.infer<
  typeof CurriculumSourceBriefSchema
>;
export type CurriculumVerification = z.infer<
  typeof CurriculumVerificationSchema
>;
