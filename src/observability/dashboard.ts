import { createHash } from "node:crypto";
import { z } from "zod";
import type { CurriculumPack } from "../curriculum/schema.js";
import type { LearningRepository } from "../domain/learner.js";

const DashboardTurnSchema = z.object({
  sequence: z.number().int().positive(),
  learner_answer: z.string(),
  spoken_response: z.string(),
  diagnosis: z.string(),
  language_mode: z.string(),
  next_strategy: z.string(),
  mastery_status: z.string(),
  mastery_evidence: z.string(),
  model_route: z.string(),
  created_at: z.string().datetime(),
});

const DashboardSessionSchema = z.object({
  session_id: z.string(),
  learner_ref: z.string(),
  concept_id: z.string(),
  concept_title: z.string(),
  status: z.string(),
  turn_count: z.number().int().nonnegative(),
  mastery_status: z.string(),
  mastery_evidence: z.string(),
  last_diagnosis: z.string(),
  updated_at: z.string().datetime(),
  turns: z.array(DashboardTurnSchema),
});

export const DashboardSnapshotSchema = z.object({
  generated_at: z.string().datetime(),
  sessions: z.array(DashboardSessionSchema),
});

export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;

function learnerReference(learnerId: string): string {
  const digest = createHash("sha256").update(learnerId).digest("hex");
  return `learner_${digest.slice(0, 10)}`;
}

export function buildDashboardSnapshot(options: {
  repository: LearningRepository;
  curriculumPack: CurriculumPack;
  limit?: number;
  now?: Date;
}): DashboardSnapshot {
  const conceptTitles = new Map(
    options.curriculumPack.concepts.map((concept) => [concept.id, concept.title]),
  );
  const sessions = options.repository
    .listRecentLessons(options.limit ?? 20)
    .map((session) => ({
      session_id: session.id,
      learner_ref: learnerReference(session.learnerId),
      concept_id: session.concept,
      concept_title: conceptTitles.get(session.concept) ?? session.concept,
      status: session.status,
      turn_count: session.turnCount,
      mastery_status: session.masteryStatus,
      mastery_evidence: session.masteryEvidence,
      last_diagnosis: session.lastDiagnosis,
      updated_at: session.updatedAt,
      turns: options.repository.listTurns(session.id).map((entry) => ({
        sequence: entry.sequence,
        learner_answer: entry.turn.learner_answer,
        spoken_response: entry.turn.spoken_response,
        diagnosis: entry.turn.diagnosis,
        language_mode: entry.turn.language_mode,
        next_strategy: entry.turn.next_strategy,
        mastery_status: entry.turn.mastery_status,
        mastery_evidence: entry.turn.mastery_evidence,
        model_route: entry.modelRoute,
        created_at: entry.createdAt,
      })),
    }));

  return DashboardSnapshotSchema.parse({
    generated_at: (options.now ?? new Date()).toISOString(),
    sessions,
  });
}
