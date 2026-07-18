import { z } from "zod";

export const EducatorAssignmentSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  educatorId: z.string().min(1),
  curriculumPackId: z.string().min(1),
  conceptId: z.string().min(1),
  learnerAuthorized: z.boolean(),
  guardianAuthorized: z.boolean(),
  authorizationExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const EducatorSummarySchema = z.object({
  learnerId: z.string().min(1),
  displayName: z.string().min(1).max(80),
  lessonsCompleted: z.number().int().nonnegative(),
  assignedSubject: z.string().min(1).max(80),
  conceptStates: z.array(
    z.object({
      conceptId: z.string().min(1),
      mastery: z.enum(["needs_support", "developing", "secure"]),
      evidenceSummary: z.string().min(1).max(300),
    }),
  ),
  suggestedHumanSupport: z.string().max(300).nullable(),
  excludesRawConversations: z.literal(true),
  generatedAt: z.string().datetime(),
});

export type EducatorAssignment = z.infer<typeof EducatorAssignmentSchema>;
export type EducatorSummary = z.infer<typeof EducatorSummarySchema>;
