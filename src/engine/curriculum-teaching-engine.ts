import type { CurriculumPack } from "../curriculum/schema.js";
import {
  TeachingRequestSchema,
  TeachingTurnSchema,
  type TeachingRequest,
  type TeachingTurn,
} from "../domain/teaching.js";
import type { LanguageDetector } from "../language/language-detector.js";
import type { TeachingEngine } from "./teaching-engine.js";

function includesAny(answer: string, signals: string[]): boolean {
  return signals.some((signal) => answer.includes(signal.toLowerCase()));
}

export class CurriculumTeachingEngine implements TeachingEngine {
  readonly #pack: CurriculumPack;
  readonly #languageDetector: LanguageDetector;

  constructor(options: {
    pack: CurriculumPack;
    languageDetector: LanguageDetector;
  }) {
    this.#pack = options.pack;
    this.#languageDetector = options.languageDetector;
  }

  async teach(unparsedRequest: TeachingRequest): Promise<TeachingTurn> {
    const request = TeachingRequestSchema.parse(unparsedRequest);
    const concept = this.#pack.concepts.find(
      (candidate) => candidate.id === request.concept,
    );
    if (!concept) {
      throw new Error(
        `Concept ${request.concept} is not present in curriculum pack ${this.#pack.id}.`,
      );
    }

    const answer = request.learnerAnswer.trim();
    const normalized = answer.toLowerCase();
    const language = this.#languageDetector.detect(
      answer,
      request.requestedLanguageMode,
    );
    const scaffold = concept.teachingScaffold;
    const base = {
      learner_id: request.learnerId,
      concept: request.concept,
      learner_answer: answer,
      language_mode: language,
      should_end_session: false,
    } as const;

    if (!answer) {
      return TeachingTurnSchema.parse({
        ...base,
        diagnosis: "No reasoning evidence yet; the learner may need a smaller entry step.",
        next_strategy: "smaller_step",
        mastery_status: "needs_support",
        mastery_evidence: "No answer was provided.",
        next_question: scaffold.silenceQuestion,
        spoken_response: `${scaffold.silenceResponseLead} ${scaffold.silenceQuestion}`,
      });
    }

    if (includesAny(normalized, scaffold.answerRequestSignals)) {
      return TeachingTurnSchema.parse({
        ...base,
        diagnosis: scaffold.answerRequestDiagnosis,
        next_strategy: "ask_reasoning",
        mastery_status: "needs_support",
        mastery_evidence: scaffold.answerRequestEvidence,
        next_question: scaffold.answerRequestQuestion,
        spoken_response: `${scaffold.answerRequestResponseLead} ${scaffold.answerRequestQuestion}`,
      });
    }

    const misconception = concept.misconceptions.find((candidate) =>
      includesAny(normalized, candidate.signals),
    );
    if (misconception) {
      return TeachingTurnSchema.parse({
        ...base,
        diagnosis: misconception.diagnosis,
        next_strategy: misconception.strategy,
        mastery_status: "needs_support",
        mastery_evidence: misconception.masteryEvidence,
        next_question: misconception.nextQuestion,
        spoken_response: `${misconception.responseLead} ${misconception.nextQuestion}`,
      });
    }

    const evidenceRule = scaffold.evidenceRules.find(
      (rule) =>
        includesAny(normalized, rule.answerSignals) &&
        includesAny(normalized, rule.reasoningSignals),
    );
    if (evidenceRule) {
      return TeachingTurnSchema.parse({
        ...base,
        diagnosis: evidenceRule.diagnosis,
        next_strategy: "retrieval_practice",
        mastery_status: "developing",
        mastery_evidence: evidenceRule.masteryEvidence,
        next_question: evidenceRule.nextQuestion,
        spoken_response: `${evidenceRule.responseLead} ${evidenceRule.nextQuestion}`,
      });
    }

    return TeachingTurnSchema.parse({
      ...base,
      diagnosis: scaffold.fallbackDiagnosis,
      next_strategy: "ask_reasoning",
      mastery_status: "needs_support",
      mastery_evidence: scaffold.fallbackEvidence,
      next_question: scaffold.fallbackQuestion,
      spoken_response: `${scaffold.fallbackResponseLead} ${scaffold.fallbackQuestion}`,
    });
  }
}
