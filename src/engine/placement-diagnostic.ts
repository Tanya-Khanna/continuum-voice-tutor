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

export const PlacementEvaluationRequestSchema = z.object({
  learnerId: z.string().min(1),
  answers: z.array(PlacementAnswerSchema).min(1),
});

export const PlacementCheckSchema = z.object({
  question_id: z.string().min(1),
  correct: z.boolean(),
  evidence: z.string().min(1),
});

export const PlacementEvaluationSchema = z.object({
  checks: z.array(PlacementCheckSchema).min(1),
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
export type PlacementEvaluationRequest = z.infer<
  typeof PlacementEvaluationRequestSchema
>;
export type PlacementEvaluation = z.infer<typeof PlacementEvaluationSchema>;

function includesAny(answer: string, signals: string[]): boolean {
  const normalized = answer.toLowerCase();
  return signals.some((signal) => normalized.includes(signal.toLowerCase()));
}

export function evaluatePlacement(
  pack: CurriculumPack,
  unparsedAnswers: PlacementAnswer[],
): PlacementResult {
  return placementResultFromEvaluation(
    pack,
    evaluatePlacementEvidence(pack, unparsedAnswers),
  );
}

export function evaluatePlacementEvidence(
  pack: CurriculumPack,
  unparsedAnswers: PlacementAnswer[],
): PlacementEvaluation {
  const diagnostic = pack.placementDiagnostic;
  const answers = z
    .array(PlacementAnswerSchema)
    .length(diagnostic.questions.length)
    .parse(unparsedAnswers);
  const byId = new Map(
    answers.map((answer) => [answer.questionId, answer.answer]),
  );

  return PlacementEvaluationSchema.parse({
    checks: diagnostic.questions.map((question) => {
      const answer = byId.get(question.id) ?? "";
      const answerMatches = includesAny(answer, question.answerSignals);
      const reasoningMatches =
        question.reasoningSignals.length === 0 ||
        includesAny(answer, question.reasoningSignals);
      const correct = answerMatches && reasoningMatches;
      return {
        question_id: question.id,
        correct,
        evidence: correct
          ? "correct with required evidence."
          : "missing or insufficient reasoning evidence.",
      };
    }),
  });
}

export function placementResultFromEvaluation(
  pack: CurriculumPack,
  unparsedEvaluation: PlacementEvaluation,
): PlacementResult {
  const diagnostic = pack.placementDiagnostic;
  const evaluation = PlacementEvaluationSchema.parse(unparsedEvaluation);
  const expectedIds = diagnostic.questions.map((question) => question.id);
  const actualIds = evaluation.checks.map((check) => check.question_id);
  if (
    actualIds.length !== expectedIds.length ||
    actualIds.some((id, index) => id !== expectedIds[index])
  ) {
    throw new Error(
      "Placement evaluation did not preserve every question ID in order.",
    );
  }
  const score = evaluation.checks.filter((check) => check.correct).length;
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
    evidence: evaluation.checks.map(
      (check, index) => `Question ${index + 1}: ${check.evidence}`,
    ),
    recommendedConcept: diagnostic.recommendations[level],
  });
}
