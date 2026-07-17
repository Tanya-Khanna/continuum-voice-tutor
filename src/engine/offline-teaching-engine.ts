import { comparingUnitFractions } from "../curriculum/fractions.pack.js";
import {
  TeachingRequestSchema,
  TeachingTurnSchema,
  type LanguageMode,
  type TeachingRequest,
  type TeachingTurn,
} from "../domain/teaching.js";
import type { TeachingEngine } from "./teaching-engine.js";

const HINDI_SIGNALS = [
  "mujhe",
  "lagta",
  "samajh",
  "nahi",
  "pata",
  "bata",
  "bas",
  "kyunki",
  "bada",
  "chhota",
  "hai",
    "roti",
  "बताओ",
  "क्योंकि",
  "नहीं",
];

function resolveLanguage(
  answer: string,
  requested: LanguageMode,
): Exclude<LanguageMode, "auto"> {
  if (requested !== "auto") return requested;

  const normalized = answer.toLowerCase();
  const containsDevanagari = /[\u0900-\u097f]/u.test(answer);
  if (containsDevanagari) return "hi";
  if (HINDI_SIGNALS.some((signal) => normalized.includes(signal))) {
    return "hinglish";
  }
  return "en";
}

function makeTurn(turn: TeachingTurn): TeachingTurn {
  return TeachingTurnSchema.parse(turn);
}

export class OfflineTeachingEngine implements TeachingEngine {
  async teach(unparsedRequest: TeachingRequest): Promise<TeachingTurn> {
    const request = TeachingRequestSchema.parse(unparsedRequest);
    const answer = request.learnerAnswer.trim();
    const normalized = answer.toLowerCase();
    const language = resolveLanguage(answer, request.requestedLanguageMode);
    const base = {
      learner_id: request.learnerId,
      concept: request.concept,
      learner_answer: answer,
      language_mode: language,
      should_end_session: false,
    } as const;

    if (answer.length === 0) {
      const question =
        "Imagine one roti shared equally by three people. How many equal pieces would you make?";
      return makeTurn({
        ...base,
        diagnosis: "No reasoning evidence yet; the learner may need a smaller entry step.",
        next_strategy: "smaller_step",
        mastery_status: "needs_support",
        mastery_evidence: "No answer was provided.",
        next_question: question,
        spoken_response: `That is okay. We can start small. ${question}`,
      });
    }

    if (
      normalized.includes("just tell") ||
      normalized.includes("give me the answer") ||
      normalized.includes("answer bata") ||
      normalized.includes("bas bata")
    ) {
      const question =
        "If the same roti is shared among more people, does each person receive more or less?";
      return makeTurn({
        ...base,
        diagnosis: "The learner requested the result without showing reasoning.",
        next_strategy: "ask_reasoning",
        mastery_status: "needs_support",
        mastery_evidence: "No mathematical reasoning was provided.",
        next_question: question,
        spoken_response: `I will help you work it out, not leave you with a guess. ${question}`,
      });
    }

    const misconception = comparingUnitFractions.misconceptions.find((candidate) =>
      candidate.signals.some((signal) => normalized.includes(signal)),
    );
    if (misconception) {
      const question =
        "One equal roti is shared by three people and another by four. Which person gets the larger piece, and why?";
      const prefix =
        language === "hinglish"
          ? "Achha, let us test that idea with the same-sized rotis."
          : "Good, let us test that idea with same-sized rotis.";
      return makeTurn({
        ...base,
        diagnosis: misconception.diagnosis,
        next_strategy: "concrete_analogy",
        mastery_status: "needs_support",
        mastery_evidence: "The answer uses denominator size as fraction size.",
        next_question: question,
        spoken_response: `${prefix} ${question}`,
      });
    }

    const saysOneThird =
      normalized.includes("one third") ||
      normalized.includes("one-third") ||
      normalized.includes("1/3");
    const explainsPieceSize = [
      "fewer pieces",
      "less pieces",
      "three people",
      "bigger piece",
      "four pieces are smaller",
      "more people",
      "kam log",
      "teen log",
    ].some((signal) => normalized.includes(signal));

    if (saysOneThird && explainsPieceSize) {
      const question =
        "Now compare one fifth and one eighth. Which share is larger, and what rule are you using?";
      return makeTurn({
        ...base,
        diagnosis: "The learner correctly connects denominator size with equal-piece size.",
        next_strategy: "retrieval_practice",
        mastery_status: "developing",
        mastery_evidence: "The learner chose one third and justified it using piece size.",
        next_question: question,
        spoken_response: `Exactly. More equal pieces make each piece smaller. ${question}`,
      });
    }

    const question =
      "What do the three and four tell us about how many equal pieces each whole was split into?";
    return makeTurn({
      ...base,
      diagnosis: "The response does not yet show enough evidence to identify stable understanding.",
      next_strategy: "ask_reasoning",
      mastery_status: "needs_support",
      mastery_evidence: "The learner has not explained the role of the denominators.",
      next_question: question,
      spoken_response: `Let us look at what the numbers mean. ${question}`,
    });
  }
}
