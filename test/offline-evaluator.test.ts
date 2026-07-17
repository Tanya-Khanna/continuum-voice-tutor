import { describe, expect, it } from "vitest";
import { offlineEvalCases } from "../src/evals/cases.js";
import { runOfflineEvaluation } from "../src/evals/offline-evaluator.js";

describe("25-case teaching evaluation", () => {
  it("contains exactly 25 frozen cases", () => {
    expect(offlineEvalCases).toHaveLength(25);
  });

  it("passes every deterministic quality gate", async () => {
    const report = await runOfflineEvaluation();
    expect(
      report.results.filter((result) => !result.passed),
      JSON.stringify(report.results, null, 2),
    ).toEqual([]);
    expect(report.passRate).toBe(1);
    expect(report.voiceFriendlyRate).toBe(1);
  });
});
