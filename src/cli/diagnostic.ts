import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import {
  evaluatePlacement,
  placementQuestions,
  type PlacementAnswer,
} from "../engine/placement-diagnostic.js";

async function main(): Promise<void> {
  const terminal = createInterface({ input, output });
  const answers: PlacementAnswer[] = [];
  let questionIndex = 0;

  output.write("Nomad AI — three-question placement diagnostic\n\n");
  output.write(`Nomad: ${placementQuestions[questionIndex]!.prompt}\nYou: `);

  try {
    for await (const answer of terminal) {
      const question = placementQuestions[questionIndex];
      if (!question) break;
      answers.push({ questionId: question.id, answer });
      questionIndex += 1;

      const nextQuestion = placementQuestions[questionIndex];
      if (!nextQuestion) break;
      output.write(`Nomad: ${nextQuestion.prompt}\nYou: `);
    }
  } finally {
    terminal.close();
  }

  if (answers.length !== placementQuestions.length) {
    output.write("\nDiagnostic stopped before all questions were answered.\n");
    return;
  }

  const result = evaluatePlacement(answers);
  output.write(`\nPlacement: ${result.level}\n`);
  output.write(`Evidence score: ${result.score} of 3\n`);
  output.write(
    `Recommended starting concept: ${result.recommendedConcept.replaceAll("_", " ")}\n`,
  );
}

await main();
