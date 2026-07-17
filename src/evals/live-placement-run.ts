import { loadCurriculumPack } from "../config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import { placementResultFromEvaluation } from "../engine/placement-diagnostic.js";

const environment = loadEnvironment();
const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
const engine = new OpenAITeachingEngine({
  apiKey: requireOpenAIKey(environment),
  model: environment.OPENAI_TEXT_MODEL,
  curriculumPack,
});

const { value: evaluation } = await engine.evaluatePlacement({
  learnerId: "live-placement-eval",
  answers: [
    {
      questionId: "equal_shares",
      answer: "Cada persona recibe la mitad.",
    },
    {
      questionId: "compare_halves_quarters",
      answer:
        "Un medio es mayor, porque al dividir en menos partes iguales cada parte es más grande.",
    },
    {
      questionId: "compare_thirds_fifths",
      answer:
        "Un tercio es mayor; con menos partes iguales, cada pedazo queda más grande.",
    },
  ],
});
const result = placementResultFromEvaluation(curriculumPack, evaluation);
const passed = result.level === "grade_ready" && result.score === 3;

console.log(
  `${passed ? "PASS" : "FAIL"} live-placement-spanish (${result.score}/${result.total}, ${result.level})`,
);
if (!passed) process.exitCode = 1;

