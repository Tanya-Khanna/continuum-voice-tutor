import { readFile } from "node:fs/promises";
import { AgentEvalReportSchema, type AgentEvalReport } from "./schema.js";

export async function readAgentEvalReport(
  path: string,
): Promise<AgentEvalReport | null> {
  try {
    return AgentEvalReportSchema.parse(
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
