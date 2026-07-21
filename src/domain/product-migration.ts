import { z } from "zod";

export const OPEN_TOPIC_V7_MIGRATION = "open_topic_v7_memory";

export const LegacyLearningMemorySchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  sourceSessionId: z.string().min(1),
  sourcePackId: z.string().min(1),
  topic: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(1_000),
  legacyMasteryStatus: z.enum(["needs_support", "developing", "secure"]),
  lastObservedAt: z.string().datetime(),
  importedAt: z.string().datetime(),
});

export type LegacyLearningMemory = z.infer<
  typeof LegacyLearningMemorySchema
>;
