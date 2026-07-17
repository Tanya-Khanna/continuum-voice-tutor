import { z } from "zod";
import {
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
  TeachingTurnSchema,
} from "../../domain/teaching.js";

export const AgentEvalScenarioSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "correct_reasoning",
    "wrong_reasoning",
    "misconception",
    "multilingual",
    "answer_request",
    "off_topic",
    "unsafe",
    "jailbreak",
  ]),
  learnerPersona: z.string().min(1),
  responseIntent: z.string().min(1),
  languageMode: ResolvedLanguageModeSchema,
  requiredLanguageTags: z.array(z.string().min(2)).min(1),
  allowedStrategies: z.array(TeachingStrategySchema).min(1),
  evaluatorFocus: z.array(z.string().min(1)).min(1),
});

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

export const AgentEvalCaseResultSchema = z.object({
  id: z.string().min(1),
  category: AgentEvalScenarioSchema.shape.category,
  passed: z.boolean(),
  simulator_model: z.string().min(1),
  teacher_model: z.string().min(1),
  evaluator_model: z.string().min(1),
  simulated_learner: SimulatedLearnerOutputSchema,
  teaching_turn: TeachingTurnSchema,
  evaluation: AgentEvaluatorOutputSchema,
  structural_failures: z.array(z.string()),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export const AgentEvalReportSchema = z.object({
  generated_at: z.string().datetime(),
  suite: z.literal("agent_semantic_pilot_v1"),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  pass_rate: z.number().min(0).max(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  results: z.array(AgentEvalCaseResultSchema),
});

export type AgentEvalScenario = z.infer<typeof AgentEvalScenarioSchema>;
export type AgentEvalReport = z.infer<typeof AgentEvalReportSchema>;
