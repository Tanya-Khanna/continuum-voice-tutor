import { runOpenTopicOfflineEvaluation } from "./open-topic-offline-evaluator.js";

const report = await runOpenTopicOfflineEvaluation();

for (const result of report.results) {
  const marker = result.passed ? "PASS" : "FAIL";
  console.log(`${marker} ${result.id} (${result.category})`);
  for (const failure of result.failures) console.log(`  - ${failure}`);
}

console.log("");
console.log(`Cases: ${report.passed}/${report.total}`);
console.log(`Pass rate: ${(report.passRate * 100).toFixed(0)}%`);
console.log(
  `Voice-policy rate: ${(report.voiceFriendlyRate * 100).toFixed(0)}%`,
);

if (report.passRate < 1 || report.voiceFriendlyRate < 1) {
  process.exitCode = 1;
}
