import { z } from "zod";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";

const CurriculumSourceBriefBaseSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  deployment: z.object({
    country: z.string().min(1),
    countryCode: z.string().regex(/^[A-Z]{2}$/u),
    subject: z.string().min(1),
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
  requiredVocabulary: z
    .array(
      z.object({
        conceptId: z.string().min(1),
        canonicalTerm: z.string().min(1),
        termLanguage: ResolvedLanguageModeSchema,
        meaning: z.string().min(1),
      }),
    )
    .default([]),
  localContextNotes: z.array(z.string().min(1)).default([]),
  originalityRequirements: z.array(z.string().min(1)).min(1),
});

export const PendingCurriculumReviewSchema = z.object({
  status: z.literal("pending"),
  notes: z.array(z.string().min(1)).default([]),
});

export const ApprovedCurriculumReviewSchema = z.object({
  status: z.literal("approved"),
  reviewedBy: z.string().trim().min(1),
  reviewedAt: z.string().datetime(),
  reviewedSourceUrls: z.array(z.string().url()).min(1),
  scopeNotes: z.array(z.string().min(1)).min(1),
});

function enforceBriefConsistency(
  brief: z.infer<typeof CurriculumSourceBriefBaseSchema> & {
    review: z.infer<
      | typeof PendingCurriculumReviewSchema
      | typeof ApprovedCurriculumReviewSchema
    >;
  },
  context: z.RefinementCtx,
): void {
  if (brief.subject !== brief.deployment.subject) {
    context.addIssue({
      code: "custom",
      path: ["deployment", "subject"],
      message: "Top-level and deployment subjects must match exactly.",
    });
  }

  if (brief.review.status !== "approved") return;
  const materialUrls = new Set(brief.sourceMaterials.map((source) => source.url));
  const reviewedUrls = new Set(brief.review.reviewedSourceUrls);
  if (
    materialUrls.size !== reviewedUrls.size ||
    [...materialUrls].some((url) => !reviewedUrls.has(url))
  ) {
    context.addIssue({
      code: "custom",
      path: ["review", "reviewedSourceUrls"],
      message:
        "The approval receipt must cover every source URL and no unlisted source.",
    });
  }
}

export const CurriculumSourceBriefDraftSchema = CurriculumSourceBriefBaseSchema
  .extend({
    review: z
      .discriminatedUnion("status", [
        PendingCurriculumReviewSchema,
        ApprovedCurriculumReviewSchema,
      ])
      .default({ status: "pending", notes: [] }),
  })
  .superRefine(enforceBriefConsistency);

export const CurriculumSourceBriefSchema = CurriculumSourceBriefBaseSchema
  .extend({
    review: ApprovedCurriculumReviewSchema,
  })
  .superRefine(enforceBriefConsistency);

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
export type CurriculumSourceBriefDraft = z.infer<
  typeof CurriculumSourceBriefDraftSchema
>;
export type CurriculumVerification = z.infer<
  typeof CurriculumVerificationSchema
>;
