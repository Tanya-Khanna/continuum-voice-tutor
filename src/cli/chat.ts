import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { LanguageModeSchema } from "../domain/teaching.js";
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

function makeEngine(): TeachingEngine {
  const environment = loadEnvironment();
  if (environment.TEACHING_ENGINE === "openai") {
    return new OpenAITeachingEngine({
      apiKey: requireOpenAIKey(environment),
      model: environment.OPENAI_TEXT_MODEL,
    });
  }
  return new OfflineTeachingEngine();
}

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );
  const lessonService = new LessonService({
    repository,
    engine: makeEngine(),
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
  });
  const learnerName = argumentValue("--name", "Demo Learner");
  const phoneNumber = argumentValue("--phone", "+910000000001");
  const preferredLanguage = LanguageModeSchema.exclude(["auto"]).parse(
    argumentValue("--language", "en"),
  );
  let context = lessonService.beginOrResume({
    phoneNumber,
    learnerName,
    preferredLanguage,
  });
  const terminal = createInterface({ input, output });

  output.write("Nomad AI — fractions teaching demo\n");
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
