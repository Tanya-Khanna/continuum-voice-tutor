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
import {
  AgentEvalReportSchema,
  AgentEvaluatorOutputSchema,
  SimulatedLearnerOutputSchema,
  type AgentEvalScenario,
} from "./schema.js";

const SIMULATOR_INSTRUCTIONS = `You simulate one synthetic learner utterance for an evaluation. Follow the supplied persona, response intent, and language mode faithfully without making the response artificially easy for the tutor. Produce only the learner's words, language tag, and a short intent summary. Never include personal data or act as the tutor.`;

const EVALUATOR_INSTRUCTIONS = `You are an independent evaluator for a voice-first Socratic tutor. Judge the teaching turn only against the frozen curriculum, scenario intent, and evaluator focus supplied. Evaluate semantic diagnosis, language matching, natural voice formatting, premature answer disclosure, follow-up quality, justified mastery, and safety. A correct conclusion with wrong reasoning must not receive reasoning credit. overall_pass must be false if any material dimension fails. Return only the structured evaluation.`;

function safetyId(id: string): string {
  return createHash("sha256").update(`nomad-agent-eval:${id}`).digest("hex");
}

export function structuralFailures(
  scenario: AgentEvalScenario,
  turn: TeachingTurn,
): string[] {
  const failures: string[] = [];
  const tags = new Set(turn.language_mode.split("+"));
  if (!scenario.requiredLanguageTags.every((tag) => tags.has(tag))) {
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

export function selectAgentScenarios(argv: string[]): AgentEvalScenario[] {
  if (!argv.includes("--confirm-spend")) {
    throw new Error(
      "Agent eval makes three live model requests per case. Re-run with --confirm-spend and optionally --case <id>.",
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
  const results = [];

  for (const scenario of selectedScenarios) {
    const simulated = await client.responses.parse({
      model,
      instructions: SIMULATOR_INSTRUCTIONS,
      input: JSON.stringify({
        learner_persona: scenario.learnerPersona,
        response_intent: scenario.responseIntent,
        language_mode: scenario.languageMode,
        pending_question: concept.teachingScaffold.entryQuestion,
      }),
      text: { format: zodTextFormat(SimulatedLearnerOutputSchema, "simulated_learner") },
      reasoning: { effort: "low" },
      safety_identifier: safetyId(`${scenario.id}:simulator`),
      store: false,
    });
    if (!simulated.output_parsed) throw new Error(`No simulated learner output for ${scenario.id}.`);

    const taught = await teacher.teach({
      learnerId: `synthetic-agent-${scenario.id}`,
      concept: concept.id,
      learnerAnswer: simulated.output_parsed.utterance,
      requestedLanguageMode: "auto",
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
    const evaluated = await client.responses.parse({
      model,
      instructions: EVALUATOR_INSTRUCTIONS,
      input: JSON.stringify({
        scenario,
        frozen_curriculum: concept,
        simulated_learner: simulated.output_parsed,
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
    console.log(`${passed ? "PASS" : "FAIL"} ${scenario.id}`);
  }

  const passed = results.filter((result) => result.passed).length;
  const report = AgentEvalReportSchema.parse({
    generated_at: new Date().toISOString(),
    suite: "agent_semantic_pilot_v1",
    total: results.length,
    passed,
    pass_rate: results.length === 0 ? 0 : passed / results.length,
    input_tokens: results.reduce((sum, result) => sum + result.input_tokens, 0),
    output_tokens: results.reduce((sum, result) => sum + result.output_tokens, 0),
    results,
  });
  const outputPath = environment.NOMAD_AGENT_EVAL_REPORT_PATH;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nAgent semantic pilot: ${passed}/${results.length}`);
  console.log(`Report: ${outputPath}`);
  if (passed !== results.length) process.exitCode = 1;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  await runAgentEvaluation();
}
