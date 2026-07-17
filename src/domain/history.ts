import { z } from "zod";
import {
  LanguageModeSchema,
  MasteryStatusSchema,
  ResolvedLanguageModeSchema,
} from "./teaching.js";

export const LearningHistoryEntrySchema = z.object({
  concept: z.string().min(1),
  conceptTitle: z.string().min(1),
  status: z.enum(["active", "paused", "completed"]),
  turnCount: z.number().int().nonnegative(),
  masteryStatus: MasteryStatusSchema,
  masteryEvidence: z.string(),
  lastDiagnosis: z.string(),
});

export const LearningHistoryRequestSchema = z.object({
  learnerId: z.string().min(1),
  requestedLanguageMode: LanguageModeSchema,
  entries: z.array(LearningHistoryEntrySchema).max(20),
});

export const LearningHistoryResponseSchema = z.object({
  language_mode: ResolvedLanguageModeSchema,
  spoken_response: z.string().min(1),
});

export type LearningHistoryRequest = z.infer<
  typeof LearningHistoryRequestSchema
>;
export type LearningHistoryResponse = z.infer<
  typeof LearningHistoryResponseSchema
>;
