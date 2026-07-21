import { readFile } from "node:fs/promises";
import { z } from "zod";

export const OpenTopicLiveEvalResultSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  passed: z.boolean(),
  failures: z.array(z.string()),
  phase: z.string().min(1),
  topic: z.string().min(1),
  language_mode: z.string().min(1),
  knowledge_state: z.string().min(1),
  diagnosis_basis: z.string().min(1),
  strategy: z.string().min(1),
  activity_kind: z.string().min(1),
  human_support: z.string().min(1),
  model: z.string().min(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export const OpenTopicLiveEvalReportSchema = z.object({
  generated_at: z.string().datetime(),
  suite: z.literal("open_topic_live_v7"),
  revision: z.string().regex(/^[0-9a-f]{40}$/u),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  pass_rate: z.number().min(0).max(1),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  results: z.array(OpenTopicLiveEvalResultSchema),
});

export type OpenTopicLiveEvalReport = z.infer<
  typeof OpenTopicLiveEvalReportSchema
>;

export async function readOpenTopicLiveEvalReport(
  path: string,
): Promise<OpenTopicLiveEvalReport | null> {
  try {
    return OpenTopicLiveEvalReportSchema.parse(
      JSON.parse(await readFile(path, "utf8")) as unknown,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}
