import type { CurriculumPack } from "../curriculum/schema.js";
import {
  LearningHistoryRequestSchema,
  LearningHistoryResponseSchema,
  type LearningHistoryRequest,
  type LearningHistoryResponse,
} from "../domain/history.js";
import {
  TeachingRequestSchema,
  TeachingTurnSchema,
  type TeachingRequest,
  type TeachingTurn,
} from "../domain/teaching.js";
import type { LanguageDetector } from "../language/language-detector.js";

function includesAny(answer: string, signals: string[]): boolean {
  return signals.some((signal) => answer.includes(signal.toLowerCase()));
}

export class CurriculumTeachingEngine {
  readonly modelRoute = "offline";
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
    const finalize = (candidate: unknown): TeachingTurn => {
      const turn = TeachingTurnSchema.parse(candidate);
      if (request.lessonState?.phase !== "recap") {
        return turn;
      }

      const retrievalQuestion =
        concept.retrievalQuestions[
          request.lessonState.turnNumber % concept.retrievalQuestions.length
        ] ?? concept.retrievalQuestions[0]!;
      return TeachingTurnSchema.parse({
        ...turn,
        next_strategy: "recap",
        next_question: retrievalQuestion,
        spoken_response: `${this.#pack.lessonPolicy.recapResponseLead} ${this.#pack.lessonPolicy.callAgainInvitation}`,
        should_end_session: true,
      });
    };

    const safetyTurn = (diagnosis: string, responseLead: string) => {
      const previousRedirects =
        request.lessonState?.consecutiveSafetyRedirects ?? 0;
      const shouldEnd =
        previousRedirects + 1 >=
        this.#pack.safetyPolicy.maxConsecutiveRedirects;
      const returnQuestion =
        request.lessonState?.previousPrompt ?? scaffold.entryQuestion;
      return finalize({
        ...base,
        diagnosis,
        next_strategy: "safety_redirect",
        mastery_status: "needs_support",
        mastery_evidence:
          "The response did not provide evidence toward the learning objective.",
        next_question: returnQuestion,
        spoken_response: shouldEnd
          ? this.#pack.safetyPolicy.gracefulEndResponse
          : `${responseLead} ${returnQuestion}`,
        should_end_session: shouldEnd,
      });
    };

    if (
      includesAny(normalized, this.#pack.safetyPolicy.promptInjectionSignals)
    ) {
      return safetyTurn(
        this.#pack.safetyPolicy.promptInjectionDiagnosis,
        this.#pack.safetyPolicy.promptInjectionResponseLead,
      );
    }

    if (includesAny(normalized, this.#pack.safetyPolicy.unsafeSignals)) {
      return safetyTurn(
        this.#pack.safetyPolicy.unsafeDiagnosis,
        this.#pack.safetyPolicy.unsafeResponseLead,
      );
    }

    if (includesAny(normalized, this.#pack.safetyPolicy.offTopicSignals)) {
      return safetyTurn(
        this.#pack.safetyPolicy.offTopicDiagnosis,
        this.#pack.safetyPolicy.offTopicResponseLead,
      );
    }

    if (!answer) {
      return finalize({
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
      return finalize({
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
      return finalize({
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
      return finalize({
        ...base,
        diagnosis: evidenceRule.diagnosis,
        next_strategy: "retrieval_practice",
        mastery_status: "developing",
        mastery_evidence: evidenceRule.masteryEvidence,
        next_question: evidenceRule.nextQuestion,
        spoken_response: `${evidenceRule.responseLead} ${evidenceRule.nextQuestion}`,
      });
    }

    return finalize({
      ...base,
      diagnosis: scaffold.fallbackDiagnosis,
      next_strategy: "ask_reasoning",
      mastery_status: "needs_support",
      mastery_evidence: scaffold.fallbackEvidence,
      next_question: scaffold.fallbackQuestion,
      spoken_response: `${scaffold.fallbackResponseLead} ${scaffold.fallbackQuestion}`,
    });
  }

  async summarizeHistory(
    unparsedRequest: LearningHistoryRequest,
  ): Promise<LearningHistoryResponse> {
    const request = LearningHistoryRequestSchema.parse(unparsedRequest);
    const latest = request.entries[0];
    const language =
      request.requestedLanguageMode === "auto" ||
      request.requestedLanguageMode === "und"
        ? this.#pack.deployment.defaultLanguage
        : request.requestedLanguageMode;
    const spokenResponse = latest
      ? `You have worked on ${latest.conceptTitle}. Your latest progress is ${latest.masteryStatus.replaceAll("_", " ")}. Would you like to practice the last idea again?`
      : "We have not recorded a teaching turn yet. Would you like to begin now?";
    return LearningHistoryResponseSchema.parse({
      language_mode: language,
      spoken_response: spokenResponse,
    });
  }
}
