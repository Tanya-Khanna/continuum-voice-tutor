import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentEvalScenarios } from "../src/evals/agent/cases.js";
import { readAgentEvalReport } from "../src/evals/agent/report.js";
import {
  selectAgentScenarios,
  structuralFailures,
} from "../src/evals/agent/run.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";

describe("agent semantic evaluation pilot", () => {
  it("requires explicit spend confirmation and supports one-case runs", () => {
    expect(() => selectAgentScenarios([])).toThrow(/confirm-spend/u);
    expect(
      selectAgentScenarios([
        "--confirm-spend",
        "--case",
        "agent-spanish-english-switch",
      ]),
    ).toHaveLength(1);
    expect(agentEvalScenarios).toHaveLength(10);
  });

  it("applies deterministic voice, language, and strategy checks after the evaluator", async () => {
    const engine = new OfflineTeachingEngine(fractionsPack);
    const scenario = agentEvalScenarios.find(
      (candidate) => candidate.id === "agent-larger-denominator-misconception",
    )!;
    const { value: turn } = await engine.teach({
      learnerId: "agent-structural-test",
      concept: "comparing_unit_fractions",
      learnerAnswer: "One fourth is bigger because four is bigger than three.",
      requestedLanguageMode: "en",
    });
    expect(structuralFailures(scenario, turn)).toEqual([]);
  });

  it("returns null for no report and validates a saved report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nomad-agent-eval-"));
    const reportPath = join(directory, "latest.json");
    expect(await readAgentEvalReport(reportPath)).toBeNull();
    await writeFile(
      reportPath,
      JSON.stringify({
        generated_at: "2026-07-17T00:00:00.000Z",
        suite: "agent_semantic_pilot_v1",
        total: 0,
        passed: 0,
        pass_rate: 0,
        input_tokens: 0,
        output_tokens: 0,
        results: [],
      }),
      "utf8",
    );
    expect(await readAgentEvalReport(reportPath)).toMatchObject({ total: 0 });
  });
});
