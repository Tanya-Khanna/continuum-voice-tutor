import { z } from "zod";
import type { CurriculumPack } from "../curriculum/schema.js";

export const PlacementLevelSchema = z.enum([
  "foundational",
  "developing",
  "grade_ready",
]);

export const PlacementAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(),
});

export const PlacementResultSchema = z.object({
  level: PlacementLevelSchema,
  score: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  evidence: z.array(z.string()).min(1),
  recommendedConcept: z.string().min(1),
});

export type PlacementAnswer = z.infer<typeof PlacementAnswerSchema>;
export type PlacementResult = z.infer<typeof PlacementResultSchema>;

function includesAny(answer: string, signals: string[]): boolean {
  const normalized = answer.toLowerCase();
  return signals.some((signal) => normalized.includes(signal.toLowerCase()));
}

export function evaluatePlacement(
  pack: CurriculumPack,
  unparsedAnswers: PlacementAnswer[],
): PlacementResult {
  const diagnostic = pack.placementDiagnostic;
  const answers = z
    .array(PlacementAnswerSchema)
    .length(diagnostic.questions.length)
    .parse(unparsedAnswers);
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answer]));

  const checks = diagnostic.questions.map((question) => {
    const answer = byId.get(question.id) ?? "";
    const answerMatches = includesAny(answer, question.answerSignals);
    const reasoningMatches =
      question.reasoningSignals.length === 0 ||
      includesAny(answer, question.reasoningSignals);
    return answerMatches && reasoningMatches;
  });
  const score = checks.filter(Boolean).length;
  const level =
    score >= diagnostic.gradeReadyMinimum
      ? "grade_ready"
      : score >= diagnostic.developingMinimum
        ? "developing"
        : "foundational";

  return PlacementResultSchema.parse({
    level,
    score,
    total: diagnostic.questions.length,
    evidence: checks.map((correct, index) =>
      correct
        ? `Question ${index + 1}: correct with required evidence.`
        : `Question ${index + 1}: missing or insufficient reasoning evidence.`,
    ),
    recommendedConcept: diagnostic.recommendations[level],
  });
}
