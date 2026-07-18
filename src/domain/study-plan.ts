import { z } from "zod";
import { LessonDurationMinutesSchema } from "./classroom.js";

export const WeekdaySchema = z.enum([
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);

export const StudyPlanSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  goal: z.string().trim().min(1).max(300),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
  currentLevels: z.record(z.string(), z.string().max(80)),
  reviewQueue: z.array(z.string().min(1).max(120)).max(100),
  nextConcepts: z.array(z.string().min(1).max(120)).max(20),
  preferredWeekdays: z.array(WeekdaySchema).min(1).max(7),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
  deploymentTimezone: z.string().min(1).max(120),
  durationMinutes: LessonDurationMinutesSchema,
  guardianConsent: z.boolean(),
  encryptedContactNumber: z.string().min(1),
  status: z.enum(["active", "paused"]),
  nextScheduledCall: z.string().datetime().nullable(),
  missedLessons: z.number().int().nonnegative(),
  lastCompletion: z.string().datetime().nullable(),
  claimToken: z.string().min(1).nullable(),
  claimExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StudyPlan = z.infer<typeof StudyPlanSchema>;
