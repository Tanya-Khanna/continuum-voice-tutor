import { loadCurriculumPack } from "../config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import { liveEvalCases } from "./live-cases.js";

const environment = loadEnvironment();
const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
const concept = curriculumPack.concepts[0];
if (!concept) throw new Error("The selected curriculum pack has no concepts.");

const engine = new OpenAITeachingEngine({
  apiKey: requireOpenAIKey(environment),
  model: environment.OPENAI_TEXT_MODEL,
  curriculumPack,
});
let failures = 0;
const requestedCase = process.argv.includes("--case")
  ? process.argv[process.argv.indexOf("--case") + 1]
  : undefined;
const selectedCases = requestedCase
  ? liveEvalCases.filter((testCase) => testCase.id === requestedCase)
  : liveEvalCases;
if (selectedCases.length === 0) {
  throw new Error(`Unknown live eval case: ${requestedCase}`);
}

for (const testCase of selectedCases) {
  const { value: turn } = await engine.teach({
    learnerId: `synthetic-${testCase.id}`,
    concept: concept.id,
    learnerAnswer: testCase.learnerAnswer,
    requestedLanguageMode: "auto",
    lessonState: {
      turnNumber: 1,
      targetTurns: curriculumPack.lessonPolicy.targetTurns,
      phase: "explore",
      previousPrompt: concept.teachingScaffold.entryQuestion,
      previousDiagnosis: "No evidence yet.",
      priorReasoningEvidenceCount: 0,
      consecutiveSafetyRedirects: 0,
      placementLevel: "developing",
    },
  });
  const detectedTags = new Set(turn.language_mode.split("+"));
  const languagesPass = testCase.expectedLanguageTags.every((tag) =>
    detectedTags.has(tag),
  );
  const strategyPass = turn.next_strategy === testCase.expectedStrategy;
  const voicePass =
    !/[#*_`]|\d+\/\d+/u.test(turn.spoken_response) &&
    (turn.spoken_response.match(/\?/gu) ?? []).length === 1;
  const pass = languagesPass && strategyPass && voicePass;
  if (!pass) failures += 1;

  console.log(
    `${pass ? "PASS" : "FAIL"} ${testCase.id} ` +
      `[language=${turn.language_mode}; strategy=${turn.next_strategy}; voice=${voicePass ? "pass" : "fail"}]`,
  );
  if (!pass) {
    console.log(
      JSON.stringify(
        {
          diagnosis: turn.diagnosis,
          mastery_status: turn.mastery_status,
          mastery_evidence: turn.mastery_evidence,
          spoken_response: turn.spoken_response,
        },
        null,
        2,
      ),
    );
  }
}

console.log(
  `\nLive GPT-5.6 cases: ${selectedCases.length - failures}/${selectedCases.length}`,
);
if (failures > 0) process.exitCode = 1;
