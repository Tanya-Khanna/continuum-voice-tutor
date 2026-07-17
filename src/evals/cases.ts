import type {
  LanguageMode,
  TeachingTurn,
} from "../domain/teaching.js";

export interface OfflineEvalCase {
  id: string;
  category:
    | "misconception"
    | "answer_request"
    | "correct_reasoning"
    | "insufficient_evidence"
    | "multilingual";
  learnerAnswer: string;
  expected: {
    strategy: TeachingTurn["next_strategy"];
    mastery: TeachingTurn["mastery_status"];
    language?: Exclude<LanguageMode, "auto">;
    spokenIncludes?: string;
  };
}

export const offlineEvalCases: OfflineEvalCase[] = [
  {
    id: "misconception-01",
    category: "misconception",
    learnerAnswer: "One fourth is bigger because four is bigger than three.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
      spokenIncludes: "roti",
    },
  },
  {
    id: "misconception-02",
    category: "misconception",
    learnerAnswer: "I picked one fourth because 4 is bigger than 3.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
    },
  },
  {
    id: "misconception-03",
    category: "misconception",
    learnerAnswer: "The bigger denominator should mean the bigger amount.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
    },
  },
  {
    id: "misconception-04",
    category: "misconception",
    learnerAnswer: "One-fourth is bigger, since the bottom number is four.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
    },
  },
  {
    id: "misconception-05",
    category: "misconception",
    learnerAnswer: "One fourth is bigger. Four wins.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
    },
  },
  {
    id: "answer-request-01",
    category: "answer_request",
    learnerAnswer: "Just tell me.",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "answer-request-02",
    category: "answer_request",
    learnerAnswer: "Give me the answer please.",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "answer-request-03",
    category: "answer_request",
    learnerAnswer: "Can you just tell me which one?",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "answer-request-04",
    category: "answer_request",
    learnerAnswer: "Answer bata do.",
    expected: {
      strategy: "ask_reasoning",
      mastery: "needs_support",
      language: "hi-Latn+en",
    },
  },
  {
    id: "answer-request-05",
    category: "answer_request",
    learnerAnswer: "Bas bata do, I am stuck.",
    expected: {
      strategy: "ask_reasoning",
      mastery: "needs_support",
      language: "hi-Latn+en",
    },
  },
  {
    id: "correct-01",
    category: "correct_reasoning",
    learnerAnswer: "One third, because fewer pieces means each is a bigger piece.",
    expected: { strategy: "retrieval_practice", mastery: "developing" },
  },
  {
    id: "correct-02",
    category: "correct_reasoning",
    learnerAnswer: "One third. Three people each get a bigger piece.",
    expected: { strategy: "retrieval_practice", mastery: "developing" },
  },
  {
    id: "correct-03",
    category: "correct_reasoning",
    learnerAnswer: "One-third, because four pieces are smaller.",
    expected: { strategy: "retrieval_practice", mastery: "developing" },
  },
  {
    id: "correct-04",
    category: "correct_reasoning",
    learnerAnswer: "I choose 1/3 because it has fewer pieces.",
    expected: { strategy: "retrieval_practice", mastery: "developing" },
  },
  {
    id: "correct-05",
    category: "correct_reasoning",
    learnerAnswer: "One third is larger because more people make smaller shares.",
    expected: { strategy: "retrieval_practice", mastery: "developing" },
  },
  {
    id: "insufficient-01",
    category: "insufficient_evidence",
    learnerAnswer: "",
    expected: { strategy: "smaller_step", mastery: "needs_support" },
  },
  {
    id: "insufficient-02",
    category: "insufficient_evidence",
    learnerAnswer: "I am not sure.",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "insufficient-03",
    category: "insufficient_evidence",
    learnerAnswer: "Maybe?",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "insufficient-04",
    category: "insufficient_evidence",
    learnerAnswer: "One third.",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "insufficient-05",
    category: "insufficient_evidence",
    learnerAnswer: "I guessed randomly.",
    expected: { strategy: "ask_reasoning", mastery: "needs_support" },
  },
  {
    id: "multilingual-01",
    category: "multilingual",
    learnerAnswer: "Mujhe lagta hai one fourth is bigger.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
      language: "hi-Latn+en",
    },
  },
  {
    id: "multilingual-02",
    category: "multilingual",
    learnerAnswer: "No entiendo. One fourth is bigger.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
      language: "es",
    },
  },
  {
    id: "multilingual-03",
    category: "multilingual",
    learnerAnswer: "Sielewi. One fourth is bigger.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
      language: "sw",
    },
  },
  {
    id: "multilingual-04",
    category: "multilingual",
    learnerAnswer: "எனக்கு புரியவில்லை. One fourth is bigger.",
    expected: {
      strategy: "concrete_analogy",
      mastery: "needs_support",
      language: "ta",
    },
  },
  {
    id: "multilingual-05",
    category: "multilingual",
    learnerAnswer: "Pienso one third because fewer pieces makes a bigger piece.",
    expected: {
      strategy: "retrieval_practice",
      mastery: "developing",
      language: "es+en",
    },
  },
];
