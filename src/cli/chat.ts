import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { loadCurriculumPack } from "../config/curriculum.js";
import type { CurriculumPack } from "../curriculum/schema.js";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";
import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";
import { LessonService } from "../lesson/lesson-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

function argumentValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value?.trim() || fallback;
}

function makeEngine(
  environment: ReturnType<typeof loadEnvironment>,
  curriculumPack: CurriculumPack,
): TeachingEngine {
  if (environment.TEACHING_ENGINE === "openai") {
    return new OpenAITeachingEngine({
      apiKey: requireOpenAIKey(environment),
      model: environment.OPENAI_TEXT_MODEL,
      curriculumPack,
    });
  }
  return new OfflineTeachingEngine(curriculumPack);
}

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );
  const lessonService = new LessonService({
    repository,
    engine: makeEngine(environment, curriculumPack),
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    curriculumPack,
  });
  const learnerName = argumentValue("--name", "Demo Learner");
  const phoneNumber = argumentValue("--phone", "+910000000001");
  const preferredLanguage = ResolvedLanguageModeSchema.parse(
    argumentValue("--language", "en"),
  );
  let context = lessonService.beginOrResume({
    phoneNumber,
    learnerName,
    preferredLanguage,
  });
  const terminal = createInterface({ input, output });

  output.write(`Nomad AI — ${curriculumPack.id}\n`);
  output.write(`Engine: ${environment.TEACHING_ENGINE}\n`);
  output.write(`Learner: ${context.learner.name}\n`);
  output.write(`Session: ${context.resumed ? "resumed" : "new"}\n`);
  output.write("Type your answer, or type exit to simulate a dropped call.\n\n");
  output.write(`Nomad: ${context.greeting}\n`);
  output.write("You: ");

  try {
    for await (const learnerAnswer of terminal) {
      if (["exit", "quit"].includes(learnerAnswer.trim().toLowerCase())) break;

      const result = await lessonService.respond(context, learnerAnswer);
      context = result.context;
      output.write(`Nomad: ${result.turn.spoken_response}\n`);
      output.write(
        `  [${result.turn.mastery_status}; ${result.turn.next_strategy}; ${result.turn.language_mode}]\n`,
      );
      output.write("You: ");
    }
  } finally {
    context = lessonService.pause(context);
    terminal.close();
    repository.close();
    output.write(
      `\nSession saved after ${context.session.turnCount} teaching turn${context.session.turnCount === 1 ? "" : "s"}.\n`,
    );
  }
}

await main();
