import { loadEnvironment } from "../config/env.js";
import { createOpenTopicRuntime } from "../runtime/open-topic-runtime.js";

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const runtime = createOpenTopicRuntime(environment);
  const learnerName = "Ravi";
  const phoneNumber = "+910000000042";

  try {
    const learner = runtime.lessonService.identifyLearner({
      phoneNumber,
      learnerName,
      preferredLanguage: "en",
    });
    let context = runtime.lessonService.beginOrResumeLearner(learner);
    const created = !context.resumed && context.session.turnCount === 0;
    if (created) {
      const response = await runtime.lessonService.respond(
        context,
        "Teach me why shadows change length.",
      );
      context = response.context;
    }
    context = runtime.lessonService.pause(context, "drop");
    console.log(
      `Demo state ${created ? "created" : "already present"}: ${learnerName} is paused after ${context.session.turnCount} open-topic teaching turn${context.session.turnCount === 1 ? "" : "s"}.`,
    );
    console.log("Experience: open-topic phone teacher");
    console.log(`Pending prompt: ${context.session.lastPrompt}`);
    console.log(
      `Resume with: npm run chat -- --name ${learnerName} --phone ${phoneNumber} --language en`,
    );
  } finally {
    runtime.close();
  }
}

await main();
