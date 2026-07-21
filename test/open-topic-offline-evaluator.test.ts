import { describe, expect, it } from "vitest";
import { runOpenTopicOfflineEvaluation } from "../src/evals/open-topic-offline-evaluator.js";

describe("v7 open-topic anti-wrapper evaluation", () => {
  it("passes all 39 deterministic product, pedagogy, evidence, safety, and privacy gates", async () => {
    const report = await runOpenTopicOfflineEvaluation();
    expect(report.total).toBe(39);
    expect(
      report.results.filter((result) => !result.passed),
      JSON.stringify(report.results, null, 2),
    ).toEqual([]);
    expect(report.passRate).toBe(1);
    expect(report.voiceFriendlyRate).toBe(1);
  });
});
