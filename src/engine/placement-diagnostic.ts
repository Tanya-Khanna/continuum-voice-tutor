import { z } from "zod";

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
  score: z.number().int().min(0).max(3),
  evidence: z.array(z.string()).length(3),
  recommendedConcept: z.string().min(1),
});

export const placementQuestions = [
  {
    id: "equal_shares",
    prompt:
      "One roti is shared equally between two people. What share does each person get?",
  },
  {
    id: "compare_halves_quarters",
    prompt:
      "Which is larger, one half or one fourth? Tell me how you know.",
  },
  {
    id: "compare_thirds_fifths",
    prompt:
      "Which is larger, one third or one fifth? Tell me what happens to each piece.",
  },
] as const;

export type PlacementAnswer = z.infer<typeof PlacementAnswerSchema>;
export type PlacementResult = z.infer<typeof PlacementResultSchema>;

function includesAny(answer: string, signals: string[]): boolean {
  const normalized = answer.toLowerCase();
  return signals.some((signal) => normalized.includes(signal));
}

export function evaluatePlacement(
  unparsedAnswers: PlacementAnswer[],
): PlacementResult {
  const answers = z.array(PlacementAnswerSchema).length(3).parse(unparsedAnswers);
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answer]));

  const first = byId.get("equal_shares") ?? "";
  const second = byId.get("compare_halves_quarters") ?? "";
  const third = byId.get("compare_thirds_fifths") ?? "";

  const checks = [
    includesAny(first, ["one half", "one-half", "half", "aadha", "आधा"]),
    includesAny(second, ["one half", "one-half", "half"]) &&
      includesAny(second, ["bigger piece", "fewer pieces", "two pieces"]),
    includesAny(third, ["one third", "one-third"]) &&
      includesAny(third, ["bigger piece", "fewer pieces", "more pieces smaller"]),
  ];
  const score = checks.filter(Boolean).length;

  return PlacementResultSchema.parse({
    level: score === 3 ? "grade_ready" : score >= 1 ? "developing" : "foundational",
    score,
    evidence: checks.map((correct, index) =>
      correct
        ? `Question ${index + 1}: correct with required evidence.`
        : `Question ${index + 1}: missing or insufficient reasoning evidence.`,
    ),
    recommendedConcept:
      score === 0 ? "equal_shares" : "comparing_unit_fractions",
  });
}
