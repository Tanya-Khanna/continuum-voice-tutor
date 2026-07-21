import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline";
import { loadEnvironment } from "../config/env.js";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";
import { createOpenTopicRuntime } from "../runtime/open-topic-runtime.js";

function argumentValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value?.trim() || fallback;
}

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const runtime = createOpenTopicRuntime(environment);
  const learnerName = argumentValue("--name", "Demo Learner");
  const phoneNumber = argumentValue("--phone", "+910000000001");
  const preferredLanguage = ResolvedLanguageModeSchema.parse(
    argumentValue("--language", "en"),
  );
  const learner = runtime.lessonService.identifyLearner({
    phoneNumber,
    learnerName,
    preferredLanguage,
  });
  let context = runtime.lessonService.beginOrResumeLearner(learner);
  const terminal = createInterface({ input, output });

  output.write("Continuum — the phone teacher\n");
  output.write(`Engine: ${environment.TEACHING_ENGINE}\n`);
  output.write(`Learner: ${context.learner.name}\n`);
  output.write(`Session: ${context.resumed ? "resumed" : "new"}\n`);
  output.write("Type as if you were speaking on the call. Type exit to drop and save.\n\n");
  output.write(`Continuum: ${context.greeting}\n`);
  output.write("You: ");

  try {
    for await (const learnerInput of terminal) {
      if (["exit", "quit"].includes(learnerInput.trim().toLowerCase())) break;
      if (!learnerInput.trim()) {
        output.write("You: ");
        continue;
      }
      const result = await runtime.lessonService.respond(context, learnerInput);
      context = result.context;
      output.write(`Continuum: ${result.turn.spoken_response}\n`);
      output.write(
        `  [${result.activity.kind}; ${result.turn.next_strategy}; ${result.turn.mastery_status}; ${result.turn.language_mode}]\n`,
      );
      if (context.session.status === "completed") break;
      output.write("You: ");
    }
  } finally {
    context = runtime.lessonService.pause(context);
    terminal.close();
    runtime.close();
    output.write(
      `\nSession saved after ${context.session.turnCount} teaching turn${context.session.turnCount === 1 ? "" : "s"}.\n`,
    );
  }
}

await main();
