import { z } from "zod";
import {
  MasteryStatusSchema,
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
  TeachingTurnSchema,
} from "./teaching.js";

export const LearnerProfileSchema = z.object({
  id: z.string().min(1),
  phoneHash: z.string().length(64),
  name: z.string().min(1).max(80),
  preferredLanguage: ResolvedLanguageModeSchema,
  currentConcept: z.string().min(1),
  lastMastery: MasteryStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const LessonStatusSchema = z.enum(["active", "paused", "completed"]);

export const LessonSessionSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  concept: z.string().min(1),
  status: LessonStatusSchema,
  turnCount: z.number().int().nonnegative(),
  lastPrompt: z.string().min(1),
  lastDiagnosis: z.string(),
  lastStrategy: TeachingStrategySchema,
  masteryStatus: MasteryStatusSchema,
  masteryEvidence: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StoredTeachingTurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sequence: z.number().int().positive(),
  turn: TeachingTurnSchema,
  createdAt: z.string().datetime(),
});

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;
export type LessonSession = z.infer<typeof LessonSessionSchema>;
export type StoredTeachingTurn = z.infer<typeof StoredTeachingTurnSchema>;

export interface LearningRepository {
  findLearner(id: string): LearnerProfile | undefined;
  listLearnersForPhone(phoneHash: string): LearnerProfile[];
  saveLearner(profile: LearnerProfile): void;
  findResumableLesson(learnerId: string): LessonSession | undefined;
  findLatestLesson(learnerId: string): LessonSession | undefined;
  saveLesson(session: LessonSession): void;
  appendTurn(storedTurn: StoredTeachingTurn): void;
  listTurns(sessionId: string): StoredTeachingTurn[];
  close(): void;
}
