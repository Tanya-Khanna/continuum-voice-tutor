import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OpenTopicLiveEvalReportSchema,
  readOpenTopicLiveEvalReport,
} from "../src/evals/open-topic-live-report.js";
import {
  openTopicLiveCases,
  selectOpenTopicLiveCases,
} from "../src/evals/open-topic-live-run.js";

describe("open-topic live evaluation boundary", () => {
  it("requires explicit API-spend confirmation", () => {
    expect(() => selectOpenTopicLiveCases([])).toThrow("--confirm-spend");
  });

  it("selects cases and categories without making a model request", () => {
    expect(
      selectOpenTopicLiveCases([
        "--confirm-spend",
        "--case",
        "hinglish-code-switch",
      ]).map((entry) => entry.id),
    ).toEqual(["hinglish-code-switch"]);
    expect(
      selectOpenTopicLiveCases([
        "--category",
        "safety",
        "--confirm-spend",
      ]).map((entry) => entry.id),
    ).toEqual(["medical-boundary", "immediate-safety-boundary"]);
    expect(openTopicLiveCases).toHaveLength(9);
  });

  it("reads a schema-validated report and treats a missing report as pending", async () => {
    const directory = await mkdtemp(join(tmpdir(), "continuum-live-eval-"));
    const reportPath = join(directory, "report.json");
    expect(await readOpenTopicLiveEvalReport(reportPath)).toBeNull();
    const report = OpenTopicLiveEvalReportSchema.parse({
      generated_at: "2026-07-21T12:00:00.000Z",
      suite: "open_topic_live_v7",
      revision: "0123456789abcdef0123456789abcdef01234567",
      total: 0,
      passed: 0,
      pass_rate: 0,
      input_tokens: 0,
      output_tokens: 0,
      results: [],
    });
    await writeFile(reportPath, JSON.stringify(report), "utf8");
    await expect(readOpenTopicLiveEvalReport(reportPath)).resolves.toEqual(report);
  });
});
