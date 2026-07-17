import { z } from "zod";

export const UsageSourceSchema = z.enum([
  "responses_teaching",
  "responses_history",
  "realtime",
]);

export const ModelUsageSchema = z.object({
  source: UsageSourceSchema,
  modelRoute: z.string().min(1),
  providerResponseId: z.string().min(1).optional(),
  inputTextTokens: z.number().int().nonnegative(),
  cachedInputTextTokens: z.number().int().nonnegative(),
  outputTextTokens: z.number().int().nonnegative(),
  inputAudioTokens: z.number().int().nonnegative(),
  cachedInputAudioTokens: z.number().int().nonnegative(),
  outputAudioTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative().optional(),
});

export const StoredModelUsageSchema = ModelUsageSchema.extend({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type ModelUsage = z.infer<typeof ModelUsageSchema>;
export type StoredModelUsage = z.infer<typeof StoredModelUsageSchema>;
