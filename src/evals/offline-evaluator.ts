import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { fractionsPack } from "../curriculum/fractions.pack.js";
import { offlineEvalCases, type OfflineEvalCase } from "./cases.js";

export interface EvalCaseResult {
  id: string;
  category: OfflineEvalCase["category"];
  passed: boolean;
  failures: string[];
}

export interface EvalReport {
  total: number;
  passed: number;
  passRate: number;
  voiceFriendlyRate: number;
  results: EvalCaseResult[];
}

export async function runOfflineEvaluation(): Promise<EvalReport> {
  const engine = new OfflineTeachingEngine(fractionsPack);
  const results: EvalCaseResult[] = [];
  let voiceFriendlyCount = 0;

  for (const evalCase of offlineEvalCases) {
    const { value: turn } = await engine.teach({
      learnerId: `eval-${evalCase.id}`,
      concept: "comparing_unit_fractions",
      learnerAnswer: evalCase.learnerAnswer,
      requestedLanguageMode: "auto",
    });
    const failures: string[] = [];

    if (turn.next_strategy !== evalCase.expected.strategy) {
      failures.push(
        `strategy was ${turn.next_strategy}, expected ${evalCase.expected.strategy}`,
      );
    }
    if (turn.mastery_status !== evalCase.expected.mastery) {
      failures.push(
        `mastery was ${turn.mastery_status}, expected ${evalCase.expected.mastery}`,
      );
    }
    if (
      evalCase.expected.language &&
      turn.language_mode !== evalCase.expected.language
    ) {
      failures.push(
        `language was ${turn.language_mode}, expected ${evalCase.expected.language}`,
      );
    }
    if (
      evalCase.expected.spokenIncludes &&
      !turn.spoken_response
        .toLowerCase()
        .includes(evalCase.expected.spokenIncludes.toLowerCase())
    ) {
      failures.push(
        `spoken response did not include ${evalCase.expected.spokenIncludes}`,
      );
    }

    const voiceFriendly =
      !/[#*_`]/u.test(turn.spoken_response) &&
      !/\d+\/\d+/u.test(turn.spoken_response) &&
      (turn.spoken_response.match(/\?/gu) ?? []).length === 1;
    if (voiceFriendly) voiceFriendlyCount += 1;
    else failures.push("spoken response was not voice friendly");

    if (
      evalCase.category === "answer_request" &&
      /one third is (?:the )?(?:answer|bigger)/iu.test(turn.spoken_response)
    ) {
      failures.push("response prematurely revealed the answer");
    }

    results.push({
      id: evalCase.id,
      category: evalCase.category,
      passed: failures.length === 0,
      failures,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    passRate: passed / results.length,
    voiceFriendlyRate: voiceFriendlyCount / results.length,
    results,
  };
}
