import { z } from "zod";
import {
  PersistedTeachingTurnSchema,
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
} from "../../domain/teaching.js";

export const AgentEvalCategorySchema = z.enum([
  "correct_reasoning",
  "wrong_reasoning",
  "misconception",
  "multilingual",
  "answer_request",
  "off_topic",
  "unsafe",
  "jailbreak",
  "recovery",
  "identity",
  "placement",
  "callback",
  "menu",
  "sandbox",
  "voice_format",
]);

const AgentScenarioBaseSchema = z.object({
  id: z.string().min(1),
  category: AgentEvalCategorySchema,
  learnerPersona: z.string().min(1),
  responseIntent: z.string().min(1),
  languageMode: ResolvedLanguageModeSchema,
  evaluatorFocus: z.array(z.string().min(1)).min(1),
});

export const SemanticAgentEvalScenarioSchema = AgentScenarioBaseSchema.extend({
  kind: z.literal("teaching_turn"),
  learnerInputMode: z.enum(["simulated", "silence"]).default("simulated"),
  requiredLanguageTags: z.array(z.string().min(2)).min(1),
  allowedStrategies: z.array(TeachingStrategySchema).min(1),
});

export const OrchestrationAdapterSchema = z.enum([
  "disconnect_persistence",
  "reconnect_resume",
  "shared_phone_separation",
  "shared_phone_resume",
  "placement_accuracy",
  "callback_retrieval",
  "menu_guided",
  "menu_sandbox",
  "sandbox_hedging",
  "voice_math_format",
]);

export const OrchestrationAgentEvalScenarioSchema =
  AgentScenarioBaseSchema.extend({
    kind: z.literal("orchestration"),
    adapter: OrchestrationAdapterSchema,
  });

export const AgentEvalScenarioSchema = z.discriminatedUnion("kind", [
  SemanticAgentEvalScenarioSchema,
  OrchestrationAgentEvalScenarioSchema,
]);

export const SimulatedLearnerOutputSchema = z.object({
  utterance: z.string().trim().min(1).max(600),
  language_mode: ResolvedLanguageModeSchema,
  intent_summary: z.string().min(1).max(300),
});

export const AgentEvaluatorOutputSchema = z.object({
  diagnosis_correct: z.boolean(),
  language_match: z.boolean(),
  voice_friendly: z.boolean(),
  no_premature_answer: z.boolean(),
  follow_up_quality: z.boolean(),
  mastery_justified: z.boolean(),
  safety_correct: z.boolean(),
  overall_pass: z.boolean(),
  rationale: z.string().min(1).max(1_000),
  failures: z.array(z.string().min(1)),
});

export const OrchestrationCheckSchema = z.object({
  id: z.string().min(1),
  passed: z.boolean(),
  detail: z.string().min(1),
});

export const OrchestrationArtifactSchema = z.object({
  adapter: OrchestrationAdapterSchema,
  summary: z.string().min(1),
  checks: z.array(OrchestrationCheckSchema).min(1),
  observations: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export const OrchestrationEvaluatorOutputSchema = z.object({
  state_transition_correct: z.boolean(),
  continuity_correct: z.boolean(),
  isolation_correct: z.boolean(),
  routing_correct: z.boolean(),
  safety_correct: z.boolean(),
  overall_pass: z.boolean(),
  rationale: z.string().min(1).max(1_000),
  failures: z.array(z.string().min(1)),
});

const CommonResultSchema = z.object({
  id: z.string().min(1),
  category: AgentEvalCategorySchema,
  passed: z.boolean(),
  simulator_model: z.string().min(1),
  teacher_model: z.string().min(1),
  evaluator_model: z.string().min(1),
  simulated_learner: SimulatedLearnerOutputSchema,
  structural_failures: z.array(z.string()),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export const SemanticAgentEvalCaseResultSchema = CommonResultSchema.extend({
  kind: z.literal("teaching_turn"),
  teaching_turn: PersistedTeachingTurnSchema,
  evaluation: AgentEvaluatorOutputSchema,
});

export const OrchestrationAgentEvalCaseResultSchema =
  CommonResultSchema.extend({
    kind: z.literal("orchestration"),
    artifact: OrchestrationArtifactSchema,
    evaluation: OrchestrationEvaluatorOutputSchema,
  });

export const AgentEvalCaseResultSchema = z.discriminatedUnion("kind", [
  SemanticAgentEvalCaseResultSchema,
  OrchestrationAgentEvalCaseResultSchema,
]);

const AgentEvalReportBaseSchema = z.object({
  generated_at: z.string().datetime(),
  suite: z.enum(["agent_semantic_pilot_v1", "agent_full_v1"]),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  pass_rate: z.number().min(0).max(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  results: z.array(AgentEvalCaseResultSchema),
});

export const AgentEvalReportSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const report = value as Record<string, unknown>;
  if (!Array.isArray(report.results)) return value;
  return {
    ...report,
    results: report.results.map((result) =>
      result && typeof result === "object" && !("kind" in result)
        ? { ...(result as Record<string, unknown>), kind: "teaching_turn" }
        : result,
    ),
  };
}, AgentEvalReportBaseSchema);

export type SemanticAgentEvalScenario = z.infer<
  typeof SemanticAgentEvalScenarioSchema
>;
export type OrchestrationAgentEvalScenario = z.infer<
  typeof OrchestrationAgentEvalScenarioSchema
>;
export type AgentEvalScenario = z.infer<typeof AgentEvalScenarioSchema>;
export type OrchestrationArtifact = z.infer<typeof OrchestrationArtifactSchema>;
export type AgentEvalCaseResult = z.infer<typeof AgentEvalCaseResultSchema>;
export type AgentEvalReport = z.infer<typeof AgentEvalReportBaseSchema>;
