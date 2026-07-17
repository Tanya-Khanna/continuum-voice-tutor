import { z } from "zod";
import {
  MasteryStatusSchema,
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
  PersistedTeachingTurnSchema,
} from "./teaching.js";
import type { StoredModelUsage } from "./usage.js";
import type { StoredSandboxTurn } from "./sandbox.js";

export const LearnerProfileSchema = z.object({
  id: z.string().min(1),
  phoneHash: z.string().length(64),
  name: z.string().min(1).max(80),
  preferredLanguage: ResolvedLanguageModeSchema,
  currentConcept: z.string().min(1),
  lastMastery: MasteryStatusSchema,
  placementLevel: z
    .enum(["unplaced", "foundational", "developing", "grade_ready"])
    .default("unplaced"),
  placementScore: z.number().int().nonnegative().default(0),
  placementTotal: z.number().int().nonnegative().default(0),
  placementEvidence: z.array(z.string()).default([]),
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
  turn: PersistedTeachingTurnSchema,
  modelRoute: z.string().min(1),
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
  findLesson(id: string): LessonSession | undefined;
  listRecentLessons(limit: number): LessonSession[];
  saveLesson(session: LessonSession): void;
  appendTurn(storedTurn: StoredTeachingTurn): void;
  listTurns(sessionId: string): StoredTeachingTurn[];
  appendSandboxTurn(storedTurn: StoredSandboxTurn): void;
  listSandboxTurns(sessionId: string): StoredSandboxTurn[];
  appendUsage(usage: StoredModelUsage): void;
  listUsage(sessionId: string): StoredModelUsage[];
  close(): void;
}
