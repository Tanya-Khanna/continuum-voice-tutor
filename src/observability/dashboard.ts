import { createHash } from "node:crypto";
import { z } from "zod";
import type { CurriculumPack } from "../curriculum/schema.js";
import type { LearningRepository } from "../domain/learner.js";
import { estimateUsageCost } from "./pricing.js";

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
  usage: z.object({
    request_count: z.number().int().nonnegative(),
    input_text_tokens: z.number().int().nonnegative(),
    cached_input_text_tokens: z.number().int().nonnegative(),
    output_text_tokens: z.number().int().nonnegative(),
    input_audio_tokens: z.number().int().nonnegative(),
    cached_input_audio_tokens: z.number().int().nonnegative(),
    output_audio_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    estimated_cost_usd: z.number().nonnegative().nullable(),
    pricing_as_of: z.string().optional(),
    unpriced_models: z.array(z.string()),
  }),
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
    .map((session) => {
      const usageRecords = options.repository.listUsage(session.id);
      const estimates = usageRecords.map(estimateUsageCost);
      const unpricedModels = [
        ...new Set(
          usageRecords
            .filter((_, index) => estimates[index]?.usd === null)
            .map((usage) => usage.modelRoute),
        ),
      ];
      const estimatedCost =
        unpricedModels.length > 0
          ? null
          : estimates.reduce((sum, estimate) => sum + (estimate.usd ?? 0), 0);
      const pricingDates = estimates.flatMap((estimate) =>
        estimate.asOf ? [estimate.asOf] : [],
      );
      const sum = (field: keyof (typeof usageRecords)[number]) =>
        usageRecords.reduce((total, usage) => {
          const value = usage[field];
          return total + (typeof value === "number" ? value : 0);
        }, 0);
      const inputTextTokens = sum("inputTextTokens");
      const outputTextTokens = sum("outputTextTokens");
      const inputAudioTokens = sum("inputAudioTokens");
      const outputAudioTokens = sum("outputAudioTokens");

      return {
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
      usage: {
        request_count: usageRecords.length,
        input_text_tokens: inputTextTokens,
        cached_input_text_tokens: sum("cachedInputTextTokens"),
        output_text_tokens: outputTextTokens,
        input_audio_tokens: inputAudioTokens,
        cached_input_audio_tokens: sum("cachedInputAudioTokens"),
        output_audio_tokens: outputAudioTokens,
        total_tokens:
          inputTextTokens +
          outputTextTokens +
          inputAudioTokens +
          outputAudioTokens,
        estimated_cost_usd: estimatedCost,
        ...(pricingDates.length > 0
          ? { pricing_as_of: pricingDates.sort().at(0) }
          : {}),
        unpriced_models: unpricedModels,
      },
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
    };
    });

  return DashboardSnapshotSchema.parse({
    generated_at: (options.now ?? new Date()).toISOString(),
    sessions,
  });
}
