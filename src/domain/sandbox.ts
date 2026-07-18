import { z } from "zod";
import { LanguageModeSchema, ResolvedLanguageModeSchema } from "./teaching.js";

export const SandboxRequestSchema = z.object({
  learnerId: z.string().min(1),
  learnerQuestion: z.string().min(1).max(2_000),
  requestedLanguageMode: LanguageModeSchema.default("auto"),
  previousTurns: z
    .array(
      z.object({
        learnerQuestion: z.string().min(1).max(2_000),
        spokenResponse: z.string().min(1).max(2_000),
        followUpQuestion: z.string().min(1).max(500),
        certainty: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(6)
    .default([]),
});

export const SandboxTurnSchema = z.object({
  learner_id: z.string().min(1),
  learner_question: z.string().min(1),
  language_mode: ResolvedLanguageModeSchema,
  certainty: z.enum(["low", "medium", "high"]),
  safety_status: z.enum(["safe", "redirect"]),
  spoken_response: z.string().min(1),
  follow_up_question: z.string().min(1),
  should_end_session: z.boolean(),
});

export const StoredSandboxTurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sequence: z.number().int().positive(),
  turn: SandboxTurnSchema,
  modelRoute: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type SandboxRequest = z.infer<typeof SandboxRequestSchema>;
export type SandboxTurn = z.infer<typeof SandboxTurnSchema>;
export type StoredSandboxTurn = z.infer<typeof StoredSandboxTurnSchema>;
