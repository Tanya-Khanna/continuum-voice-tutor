export interface LiveEvalCase {
  id: string;
  learnerAnswer: string;
  expectedLanguageTags: string[];
  expectedStrategy: "concrete_analogy" | "retrieval_practice";
}

export const liveEvalCases: LiveEvalCase[] = [
  {
    id: "hi-latn-en-misconception",
    learnerAnswer:
      "Mujhe lagta hai one fourth bigger hai because four is bigger than three.",
    expectedLanguageTags: ["hi-Latn", "en"],
    expectedStrategy: "concrete_analogy",
  },
  {
    id: "es-en-reasoning",
    learnerAnswer:
      "Pienso one third is bigger porque fewer pieces means each piece is bigger.",
    expectedLanguageTags: ["es", "en"],
    expectedStrategy: "retrieval_practice",
  },
  {
    id: "fr-en-misconception",
    learnerAnswer:
      "Je pense one fourth is bigger parce que four is a bigger number than three.",
    expectedLanguageTags: ["fr", "en"],
    expectedStrategy: "concrete_analogy",
  },
];
