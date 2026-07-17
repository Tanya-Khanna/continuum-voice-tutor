import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";

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
  const engine = makeEngine();
  const terminal = createInterface({ input, output });

  output.write("Nomad AI — fractions teaching demo\n");
  output.write(`Engine: ${environment.TEACHING_ENGINE}\n`);
  output.write("Type your answer, or type exit to finish.\n\n");
  output.write(
    "Nomad: Which is the bigger share, one third or one fourth? Tell me why.\n",
  );
  output.write("You: ");

  try {
    for await (const learnerAnswer of terminal) {
      if (["exit", "quit"].includes(learnerAnswer.trim().toLowerCase())) break;

      const turn = await engine.teach({
        learnerId: "local-demo-learner",
        concept: "comparing_unit_fractions",
        learnerAnswer,
        requestedLanguageMode: "auto",
      });

      output.write(`Nomad: ${turn.spoken_response}\n`);
      output.write(
        `  [${turn.mastery_status}; ${turn.next_strategy}; ${turn.language_mode}]\n`,
      );
      output.write("You: ");
    }
  } finally {
    terminal.close();
  }
}

await main();
