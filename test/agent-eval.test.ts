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
import type { TeachingEngine } from "../src/engine/teaching-engine.js";
import { runOrchestrationAdapter } from "../src/evals/agent/orchestration.js";

describe("agent evaluation harness", () => {
  it("requires explicit spend confirmation and supports one-case runs", () => {
    expect(() => selectAgentScenarios([])).toThrow(/confirm-spend/u);
    expect(
      selectAgentScenarios([
        "--confirm-spend",
        "--case",
        "agent-spanish-english-switch",
      ]),
    ).toHaveLength(1);
    expect(agentEvalScenarios).toHaveLength(24);
    expect(new Set(agentEvalScenarios.map((scenario) => scenario.id)).size).toBe(24);
    expect(
      agentEvalScenarios.filter((scenario) => scenario.kind === "teaching_turn"),
    ).toHaveLength(14);
    expect(
      agentEvalScenarios.filter((scenario) => scenario.kind === "orchestration"),
    ).toHaveLength(10);
  });

  it("runs every orchestration adapter with trusted structural checks", async () => {
    const offline = new OfflineTeachingEngine(fractionsPack);
    const controlledEngine: TeachingEngine = {
      modelRoute: "controlled-agent-test",
      teach: (request) => offline.teach(request),
      summarizeHistory: (request) => offline.summarizeHistory(request),
      explore: (request) => offline.explore(request),
      async evaluatePlacement(request) {
        return {
          value: {
            checks: request.answers.map((answer) => ({
              question_id: answer.questionId,
              correct: true,
              evidence: "Semantically correct multilingual answer.",
            })),
          },
        };
      },
    };
    const orchestrationScenarios = agentEvalScenarios.filter(
      (scenario) => scenario.kind === "orchestration",
    );

    for (const scenario of orchestrationScenarios) {
      const result = await runOrchestrationAdapter(scenario, {
        liveEngine: controlledEngine,
        simulatedUtterance:
          scenario.adapter === "sandbox_hedging"
            ? "¿Cuál es el weather right now?"
            : "One fourth is bigger because four is bigger than three.",
      });
      expect(
        result.artifact.checks.filter((check) => !check.passed),
        scenario.id,
      ).toEqual([]);
    }
  });

  it("applies deterministic voice, language, and strategy checks after the evaluator", async () => {
    const engine = new OfflineTeachingEngine(fractionsPack);
    const scenario = agentEvalScenarios.find(
      (candidate) => candidate.id === "agent-larger-denominator-misconception",
    )!;
    expect(scenario.kind).toBe("teaching_turn");
    if (scenario.kind !== "teaching_turn") throw new Error("Expected a teaching-turn scenario.");
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
