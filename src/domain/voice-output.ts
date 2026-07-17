import type { TeachingTurn } from "./teaching.js";

const spokenQuestionPattern = /[?？؟]/gu;
const symbolicFractionPattern = /\d+\s*\/\s*\d+|[¼½¾⅐-⅞]/u;
const markdownPattern = /[#*_`]/u;

function sentenceCount(value: string): number {
  return value
    .split(/[.!?。！？।؟]+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function voiceOutputFailures(turn: TeachingTurn): string[] {
  const failures: string[] = [];
  const spokenQuestions =
    turn.spoken_response.match(spokenQuestionPattern)?.length ?? 0;
  const endingWithoutQuestion =
    turn.should_end_session &&
    (turn.next_strategy === "recap" ||
      turn.next_strategy === "safety_redirect");
  const expectedSpokenQuestions = endingWithoutQuestion ? 0 : 1;

  if (spokenQuestions !== expectedSpokenQuestions) {
    failures.push(
      `spoken_response had ${spokenQuestions} questions; expected ${expectedSpokenQuestions}`,
    );
  }
  if (sentenceCount(turn.spoken_response) > 3) {
    failures.push("spoken_response exceeded three short sentences");
  }
  if (
    markdownPattern.test(turn.spoken_response) ||
    markdownPattern.test(turn.next_question)
  ) {
    failures.push("output contained Markdown-style formatting");
  }
  if (
    symbolicFractionPattern.test(turn.spoken_response) ||
    symbolicFractionPattern.test(turn.next_question)
  ) {
    failures.push("output contained a symbolic fraction");
  }
  const storedQuestions =
    turn.next_question.match(spokenQuestionPattern)?.length ?? 0;
  if (storedQuestions !== 1) {
    failures.push("next_question must contain exactly one voice question");
  }
  return failures;
}

export function assertVoiceNativeTeachingTurn(turn: TeachingTurn): void {
  const failures = voiceOutputFailures(turn);
  if (failures.length > 0) {
    throw new Error(`Teaching turn failed voice policy: ${failures.join("; ")}`);
  }
}
