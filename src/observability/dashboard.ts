import { createHash } from "node:crypto";
import { z } from "zod";
import type { CurriculumPack } from "../curriculum/schema.js";
import type { LearningRepository } from "../domain/learner.js";
import { OPEN_TOPIC_NAMESPACE } from "../domain/open-topic.js";
import { estimateUsageCost } from "./pricing.js";

const DashboardTurnSchema = z.object({
  sequence: z.number().int().positive(),
  mode: z.enum(["open_topic", "guided", "curious_sandbox"]),
  learner_answer: z.string(),
  anchor_object: z.string().nullable(),
  spoken_response: z.string(),
  diagnosis: z.string(),
  reasoning_trace: z.array(
    z.object({
      source: z.enum(["learner_stated", "tutor_inference"]),
      claim: z.string(),
      status: z.enum(["supported", "unsupported", "unclear"]),
    }),
  ),
  language_mode: z.string(),
  next_strategy: z.string(),
  mastery_status: z.string(),
  mastery_evidence: z.string(),
  model_route: z.string(),
  activity_kind: z.string().nullable(),
  strategy_changed: z.boolean().nullable(),
  evidence_kind: z.string().nullable(),
  evidence_result: z.string().nullable(),
  human_support: z.string().nullable(),
  knowledge_state: z.string().nullable(),
  created_at: z.string().datetime(),
});

const DashboardSessionSchema = z.object({
  session_id: z.string(),
  learner_ref: z.string(),
  curriculum_pack_id: z.string(),
  subject: z.string(),
  concept_id: z.string(),
  concept_title: z.string(),
  status: z.string(),
  turn_count: z.number().int().nonnegative(),
  sandbox_turn_count: z.number().int().nonnegative(),
  mastery_status: z.string(),
  mastery_evidence: z.string(),
  last_diagnosis: z.string(),
  anchor_object: z.string().nullable(),
  updated_at: z.string().datetime(),
  placement: z.object({
    level: z.string(),
    score: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    evidence: z.array(z.string()),
  }),
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
    measured_latency_count: z.number().int().nonnegative(),
    average_latency_ms: z.number().nonnegative().nullable(),
    maximum_latency_ms: z.number().nonnegative().nullable(),
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
  curriculumPack?: CurriculumPack;
  curriculumPacks?: readonly CurriculumPack[];
  limit?: number;
  now?: Date;
}): DashboardSnapshot {
  const packs =
    options.curriculumPacks ??
    (options.curriculumPack ? [options.curriculumPack] : []);
  const packsById = new Map(packs.map((pack) => [pack.id, pack]));
  const defaultPack = packs[0];
  const sessions = options.repository
    .listRecentLessons(options.limit ?? 20)
    .map((session) => {
      const learner = options.repository.findLearner(session.learnerId);
      if (!learner) {
        throw new Error(`Learner ${session.learnerId} is missing.`);
      }
      const isOpenTopic = session.curriculumPackId === OPEN_TOPIC_NAMESPACE;
      const curriculumPack = isOpenTopic
        ? undefined
        : session.curriculumPackId === "legacy"
          ? defaultPack
          : packsById.get(session.curriculumPackId);
      if (!isOpenTopic && !curriculumPack) {
        throw new Error(
          `Curriculum pack ${session.curriculumPackId} is missing from the dashboard catalog.`,
        );
      }
      const conceptTitle = isOpenTopic
        ? session.concept === "open-topic"
          ? "Awaiting learner topic"
          : session.concept
        : curriculumPack!.concepts.find(
          (concept) => concept.id === session.concept,
        )?.title ?? session.concept;
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
      const measuredLatencies = usageRecords.flatMap((usage) =>
        usage.latencyMs === undefined ? [] : [usage.latencyMs],
      );
      const decisions = options.repository.listPedagogyDecisions(session.id);
      const guidedTurns = options.repository.listTurns(session.id).map((entry, index) => ({
        mode: isOpenTopic ? ("open_topic" as const) : ("guided" as const),
        learner_answer: entry.turn.learner_answer,
        anchor_object: entry.turn.anchor_object,
        spoken_response: entry.turn.spoken_response,
        diagnosis: entry.turn.diagnosis,
        reasoning_trace: entry.turn.reasoning_trace,
        language_mode: entry.turn.language_mode,
        next_strategy: entry.turn.next_strategy,
        mastery_status: entry.turn.mastery_status,
        mastery_evidence: entry.turn.mastery_evidence,
        model_route: entry.modelRoute,
        activity_kind: decisions[index]?.activity.kind ?? null,
        strategy_changed: decisions[index]?.strategyChanged ?? null,
        evidence_kind: decisions[index]?.evidenceKind ?? null,
        evidence_result: decisions[index]?.evidenceResult ?? null,
        human_support: decisions[index]?.humanSupport ?? null,
        knowledge_state: decisions[index]?.knowledgeState ?? null,
        created_at: entry.createdAt,
      }));
      const sandboxTurns = options.repository
        .listSandboxTurns(session.id)
        .map((entry) => ({
          mode: "curious_sandbox" as const,
          learner_answer: entry.turn.learner_question,
          anchor_object: null,
          spoken_response: entry.turn.spoken_response,
          diagnosis: `Curious Sandbox response with ${entry.turn.certainty} certainty.`,
          reasoning_trace: [],
          language_mode: entry.turn.language_mode,
          next_strategy: "curious_sandbox",
          mastery_status: "not_assessed",
          mastery_evidence:
            "Sandbox interactions are excluded from guided curriculum mastery.",
          model_route: entry.modelRoute,
          activity_kind: null,
          strategy_changed: null,
          evidence_kind: null,
          evidence_result: null,
          human_support: null,
          knowledge_state: null,
          created_at: entry.createdAt,
        }));
      const turns = [...guidedTurns, ...sandboxTurns]
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .map((turn, index) => ({ ...turn, sequence: index + 1 }));

      return {
        session_id: session.id,
        learner_ref: learnerReference(session.learnerId),
        curriculum_pack_id: session.curriculumPackId,
        subject: isOpenTopic ? "Open learning" : curriculumPack!.deployment.subject,
        concept_id: session.concept,
        concept_title: conceptTitle,
        status: session.status,
        turn_count: session.turnCount,
        sandbox_turn_count: sandboxTurns.length,
        mastery_status: session.masteryStatus,
        mastery_evidence: session.masteryEvidence,
        last_diagnosis: session.lastDiagnosis,
        anchor_object: session.anchorObject,
        updated_at: session.updatedAt,
        placement: {
          level: session.placementLevel,
          score: session.placementScore,
          total: session.placementTotal,
          evidence: session.placementEvidence,
        },
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
          measured_latency_count: measuredLatencies.length,
          average_latency_ms:
            measuredLatencies.length === 0
              ? null
              : measuredLatencies.reduce((total, value) => total + value, 0) /
                measuredLatencies.length,
          maximum_latency_ms:
            measuredLatencies.length === 0
              ? null
              : Math.max(...measuredLatencies),
        },
        turns,
      };
    });

  return DashboardSnapshotSchema.parse({
    generated_at: (options.now ?? new Date()).toISOString(),
    sessions,
  });
}
