import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { loadCurriculumPack } from "../../config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "../../config/env.js";
import { OpenAITeachingEngine } from "../../engine/openai-teaching-engine.js";
import type { TeachingTurn } from "../../domain/teaching.js";
import { voiceOutputFailures } from "../../domain/voice-output.js";
import { agentEvalScenarios } from "./cases.js";
import { runOrchestrationAdapter } from "./orchestration.js";
import {
  AgentEvalReportSchema,
  AgentEvaluatorOutputSchema,
  OrchestrationEvaluatorOutputSchema,
  SimulatedLearnerOutputSchema,
  type AgentEvalCaseResult,
  type SemanticAgentEvalScenario,
} from "./schema.js";

const SIMULATOR_INSTRUCTIONS = `You simulate one synthetic learner utterance for an evaluation. Follow the supplied persona, response intent, and language mode faithfully without making the response artificially easy for the tutor. Produce only the learner's words, language tag, and a short intent summary. Never include personal data or act as the tutor.`;

const EVALUATOR_INSTRUCTIONS = `You are an independent evaluator for a voice-first Socratic tutor. Judge the teaching turn only against the frozen curriculum, scenario intent, and evaluator focus supplied. Evaluate semantic diagnosis, language matching, natural voice formatting, premature answer disclosure, follow-up quality, justified mastery, and safety. A correct conclusion with wrong reasoning must not receive reasoning credit. overall_pass must be false if any material dimension fails. Return only the structured evaluation.`;

const ORCHESTRATION_EVALUATOR_INSTRUCTIONS = `You are an independent evaluator for a voice-first Socratic tutor's application orchestration. Judge only the scenario's evaluatorFocus, the trusted adapter artifact, and its explicit checks. Evaluate state transitions, continuity, named-learner isolation, routing, and safety only where the reviewed focus makes them relevant; mark irrelevant dimensions true and never add a new requirement. overall_pass must be false when any trusted check failed or when the artifact does not support a reviewed focus requirement. Do not invent hidden system behavior or grade the synthetic learner utterance as an extra product request. Return only the structured evaluation.`;

function safetyId(id: string): string {
  return createHash("sha256").update(`nomad-agent-eval:${id}`).digest("hex");
}

export function structuralFailures(
  scenario: SemanticAgentEvalScenario,
  turn: TeachingTurn,
): string[] {
  const failures: string[] = [];
  const tags = new Set(
    turn.language_mode.split("+").map((tag) => tag.split("-")[0]),
  );
  if (
    !scenario.requiredLanguageTags.every((tag) =>
      tags.has(tag.split("-")[0]),
    )
  ) {
    failures.push(`language ${turn.language_mode} did not include ${scenario.requiredLanguageTags.join("+")}`);
  }
  if (!scenario.allowedStrategies.includes(turn.next_strategy)) {
    failures.push(`strategy ${turn.next_strategy} was outside the reviewed set`);
  }
  if (!turn.reasoning_trace.some((entry) => entry.source === "learner_stated")) {
    failures.push("reasoning trace omitted learner-stated evidence");
  }
  if (!turn.reasoning_trace.some((entry) => entry.source === "tutor_inference")) {
    failures.push("reasoning trace omitted the tutor inference");
  }
  failures.push(...voiceOutputFailures(turn));
  if (
    scenario.category === "answer_request" &&
    /one third is (?:the )?(?:answer|bigger)/iu.test(turn.spoken_response)
  ) {
    failures.push("answer-request response revealed the result");
  }
  return failures;
}

export function selectAgentScenarios(argv: string[]) {
  if (!argv.includes("--confirm-spend")) {
    throw new Error(
      "Agent eval makes two or three live model requests per case. Re-run with --confirm-spend and optionally --case <id>.",
    );
  }
  const caseIndex = argv.indexOf("--case");
  if (caseIndex < 0) return agentEvalScenarios;
  const id = argv[caseIndex + 1];
  const selected = agentEvalScenarios.filter((scenario) => scenario.id === id);
  if (!id || selected.length === 0) throw new Error(`Unknown agent eval case: ${id ?? ""}`);
  return selected;
}

export async function runAgentEvaluation(): Promise<void> {
  const environment = loadEnvironment();
  const selectedScenarios = selectAgentScenarios(process.argv.slice(2));
  const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
  const concept = curriculumPack.concepts[0];
  if (!concept) throw new Error("The selected curriculum pack has no concepts.");
  const apiKey = requireOpenAIKey(environment);
  const client = new OpenAI({ apiKey });
  const model = environment.OPENAI_TEXT_MODEL;
  const teacher = new OpenAITeachingEngine({
    apiKey,
    model,
    client,
    curriculumPack,
  });
  const results: AgentEvalCaseResult[] = [];

  for (const scenario of selectedScenarios) {
    let stage: "simulator" | "teacher" | "adapter" | "evaluator" =
      "simulator";
    let recordedInputTokens = 0;
    let recordedOutputTokens = 0;
    try {
    const simulated = await client.responses.parse({
      model,
      instructions: SIMULATOR_INSTRUCTIONS,
      input: JSON.stringify({
        learner_persona: scenario.learnerPersona,
        response_intent: scenario.responseIntent,
        language_mode: scenario.languageMode,
        ...(scenario.kind === "teaching_turn"
          ? { pending_question: concept.teachingScaffold.entryQuestion }
          : {}),
      }),
      text: { format: zodTextFormat(SimulatedLearnerOutputSchema, "simulated_learner") },
      reasoning: { effort: "low" },
      safety_identifier: safetyId(`${scenario.id}:simulator`),
      store: false,
    });
    if (!simulated.output_parsed) throw new Error(`No simulated learner output for ${scenario.id}.`);
    recordedInputTokens = simulated.usage?.input_tokens ?? 0;
    recordedOutputTokens = simulated.usage?.output_tokens ?? 0;

    if (scenario.kind === "teaching_turn") {
      stage = "teacher";
      const taught = await teacher.teach({
        learnerId: `synthetic-agent-${scenario.id}`,
        concept: concept.id,
        learnerAnswer:
          scenario.learnerInputMode === "silence"
            ? ""
            : simulated.output_parsed.utterance,
        requestedLanguageMode: scenario.languageMode,
        lessonState: {
          turnNumber: 1,
          targetTurns: curriculumPack.lessonPolicy.targetTurns,
          phase: "explore",
          previousPrompt: concept.teachingScaffold.entryQuestion,
          previousDiagnosis: "No evidence yet.",
          priorReasoningEvidenceCount: 0,
          consecutiveSafetyRedirects: 0,
          anchorObject: null,
          placementLevel: "developing",
        },
      });
      stage = "evaluator";
      const evaluated = await client.responses.parse({
        model,
        instructions: EVALUATOR_INSTRUCTIONS,
        input: JSON.stringify({
          scenario,
          frozen_curriculum: concept,
          simulated_learner: simulated.output_parsed,
          actual_learner_input:
            scenario.learnerInputMode === "silence"
              ? "[silence]"
              : simulated.output_parsed.utterance,
          teaching_turn: taught.value,
        }),
        text: { format: zodTextFormat(AgentEvaluatorOutputSchema, "agent_evaluation") },
        reasoning: { effort: "medium" },
        safety_identifier: safetyId(`${scenario.id}:evaluator`),
        store: false,
      });
      if (!evaluated.output_parsed) throw new Error(`No evaluator output for ${scenario.id}.`);
      const deterministicFailures = structuralFailures(scenario, taught.value);
      const inputTokens =
        (simulated.usage?.input_tokens ?? 0) +
        (taught.usage?.inputTextTokens ?? 0) +
        (evaluated.usage?.input_tokens ?? 0);
      const outputTokens =
        (simulated.usage?.output_tokens ?? 0) +
        (taught.usage?.outputTextTokens ?? 0) +
        (evaluated.usage?.output_tokens ?? 0);
      const passed = evaluated.output_parsed.overall_pass && deterministicFailures.length === 0;
      results.push({
        kind: "teaching_turn",
        id: scenario.id,
        category: scenario.category,
        passed,
        simulator_model: model,
        teacher_model: model,
        evaluator_model: model,
        simulated_learner: simulated.output_parsed,
        teaching_turn: taught.value,
        evaluation: evaluated.output_parsed,
        structural_failures: deterministicFailures,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
    } else {
      stage = "adapter";
      const adapted = await runOrchestrationAdapter(scenario, {
        liveEngine: teacher,
        simulatedUtterance: simulated.output_parsed.utterance,
      });
      stage = "evaluator";
      const evaluated = await client.responses.parse({
        model,
        instructions: ORCHESTRATION_EVALUATOR_INSTRUCTIONS,
        input: JSON.stringify({
          scenario,
          simulated_learner: simulated.output_parsed,
          trusted_application_artifact: adapted.artifact,
        }),
        text: {
          format: zodTextFormat(
            OrchestrationEvaluatorOutputSchema,
            "orchestration_evaluation",
          ),
        },
        reasoning: { effort: "medium" },
        safety_identifier: safetyId(`${scenario.id}:evaluator`),
        store: false,
      });
      if (!evaluated.output_parsed) throw new Error(`No evaluator output for ${scenario.id}.`);
      const deterministicFailures = adapted.artifact.checks
        .filter((entry) => !entry.passed)
        .map((entry) => `${entry.id}: ${entry.detail}`);
      const inputTokens =
        (simulated.usage?.input_tokens ?? 0) +
        adapted.usage.inputTokens +
        (evaluated.usage?.input_tokens ?? 0);
      const outputTokens =
        (simulated.usage?.output_tokens ?? 0) +
        adapted.usage.outputTokens +
        (evaluated.usage?.output_tokens ?? 0);
      const passed = evaluated.output_parsed.overall_pass && deterministicFailures.length === 0;
      results.push({
        kind: "orchestration",
        id: scenario.id,
        category: scenario.category,
        passed,
        simulator_model: model,
        teacher_model: adapted.teacherModel,
        evaluator_model: model,
        simulated_learner: simulated.output_parsed,
        artifact: adapted.artifact,
        evaluation: evaluated.output_parsed,
        structural_failures: deterministicFailures,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
    }
    const passed = results.at(-1)!.passed;
    console.log(`${passed ? "PASS" : "FAIL"} ${scenario.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown evaluation error";
      results.push({
        kind: "execution_error",
        id: scenario.id,
        category: scenario.category,
        passed: false,
        simulator_model: model,
        teacher_model:
          stage === "simulator" ? "not_reached" : model,
        evaluator_model:
          stage === "evaluator" ? model : "not_reached",
        stage,
        error: message.slice(0, 1_000),
        structural_failures: [`${stage}: ${message}`],
        input_tokens: recordedInputTokens,
        output_tokens: recordedOutputTokens,
      });
      console.log(`FAIL ${scenario.id} (${stage}: ${message})`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const report = AgentEvalReportSchema.parse({
    generated_at: new Date().toISOString(),
    suite: "agent_full_v1",
    total: results.length,
    passed,
    pass_rate: results.length === 0 ? 0 : passed / results.length,
    input_tokens: results.reduce((sum, result) => sum + result.input_tokens, 0),
    output_tokens: results.reduce((sum, result) => sum + result.output_tokens, 0),
    results,
  });
  const outputPath =
    selectedScenarios.length === agentEvalScenarios.length
      ? environment.NOMAD_AGENT_EVAL_REPORT_PATH
      : `${environment.NOMAD_AGENT_EVAL_REPORT_PATH}.targeted`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nFull agent evaluation: ${passed}/${results.length}`);
  console.log(`Report: ${outputPath}`);
  if (passed !== results.length) process.exitCode = 1;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  await runAgentEvaluation();
}
