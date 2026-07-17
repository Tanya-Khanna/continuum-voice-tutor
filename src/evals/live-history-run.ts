import { loadCurriculumPack } from "../config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";

const environment = loadEnvironment();
const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
const concept = curriculumPack.concepts[0];
if (!concept) throw new Error("The selected curriculum pack has no concepts.");

const engine = new OpenAITeachingEngine({
  apiKey: requireOpenAIKey(environment),
  model: environment.OPENAI_TEXT_MODEL,
  curriculumPack,
});
const { value: history } = await engine.summarizeHistory({
  learnerId: "synthetic-history-eval",
  requestedLanguageMode: "hi-Latn+en",
  entries: [
    {
      concept: concept.id,
      conceptTitle: concept.title,
      status: "paused",
      turnCount: 3,
      masteryStatus: "developing",
      masteryEvidence:
        "The learner compared equal-piece size correctly in one example.",
      lastDiagnosis:
        "The learner understands the idea but needs a transfer check.",
    },
  ],
});
const tags = new Set(history.language_mode.split("+"));
const languagePass = tags.has("hi-Latn") && tags.has("en");
const voicePass =
  !/[#*_`]|\d+\/\d+/u.test(history.spoken_response) &&
  (history.spoken_response.match(/\?/gu) ?? []).length === 1;
if (!languagePass || !voicePass) {
  throw new Error(
    `Live history eval failed: language=${history.language_mode}, voice=${voicePass}`,
  );
}
console.log(
  `PASS live-history-hi-latn-en [language=${history.language_mode}; voice=pass]`,
);
