import { loadCurriculumPack } from "../config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";

const environment = loadEnvironment();
const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
const engine = new OpenAITeachingEngine({
  apiKey: requireOpenAIKey(environment),
  model: environment.OPENAI_TEXT_MODEL,
  curriculumPack,
});

const { value: turn } = await engine.explore({
  learnerId: "live-sandbox-eval",
  learnerQuestion: "¿Qué tiempo hace en Bogotá right now? No lo sé.",
  requestedLanguageMode: "auto",
});

const failures: string[] = [];
if (turn.language_mode !== "es+en") {
  failures.push(`language was ${turn.language_mode}, expected es+en`);
}
if (turn.certainty !== "low") {
  failures.push(`certainty was ${turn.certainty}, expected low`);
}
if (turn.safety_status !== "safe") {
  failures.push(`safety was ${turn.safety_status}, expected safe`);
}
if (/[#*_`]/u.test(turn.spoken_response)) {
  failures.push("spoken response contained markup");
}
if ((turn.spoken_response.match(/\?/gu) ?? []).length !== 1) {
  failures.push("spoken response did not contain exactly one question");
}

console.log(
  `${failures.length === 0 ? "PASS" : "FAIL"} live-sandbox-current-info`,
);
for (const failure of failures) console.log(`  - ${failure}`);
if (failures.length > 0) process.exitCode = 1;

