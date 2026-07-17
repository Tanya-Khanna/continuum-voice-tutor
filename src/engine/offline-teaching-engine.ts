import type { CurriculumPack } from "../curriculum/schema.js";
import type {
  LearningHistoryRequest,
  LearningHistoryResponse,
} from "../domain/history.js";
import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";
import {
  ConfiguredLanguageDetector,
  type LanguageDetector,
} from "../language/language-detector.js";
import { CurriculumTeachingEngine } from "./curriculum-teaching-engine.js";
import type { TeachingEngine } from "./teaching-engine.js";
import type { ModelResult } from "./teaching-engine.js";
import {
  SandboxRequestSchema,
  SandboxTurnSchema,
  type SandboxRequest,
  type SandboxTurn,
} from "../domain/sandbox.js";

export class OfflineTeachingEngine implements TeachingEngine {
  readonly modelRoute = "offline";
  readonly #engine: CurriculumTeachingEngine;
  readonly #pack: CurriculumPack;
  readonly #languageDetector: LanguageDetector;

  constructor(
    pack: CurriculumPack,
    languageDetector: LanguageDetector = new ConfiguredLanguageDetector(pack.deployment),
  ) {
    this.#pack = pack;
    this.#languageDetector = languageDetector;
    this.#engine = new CurriculumTeachingEngine({ pack, languageDetector });
  }

  async teach(request: TeachingRequest): Promise<ModelResult<TeachingTurn>> {
    return { value: await this.#engine.teach(request) };
  }

  summarizeHistory(
    request: LearningHistoryRequest,
  ): Promise<ModelResult<LearningHistoryResponse>> {
    return this.#engine
      .summarizeHistory(request)
      .then((value) => ({ value }));
  }

  async explore(
    unparsedRequest: SandboxRequest,
  ): Promise<ModelResult<SandboxTurn>> {
    const request = SandboxRequestSchema.parse(unparsedRequest);
    const normalized = request.learnerQuestion.toLowerCase();
    const languageMode = this.#languageDetector.detect(
      request.learnerQuestion,
      request.requestedLanguageMode,
    );
    const unsafe = this.#pack.safetyPolicy.unsafeSignals.some((signal) =>
      normalized.includes(signal.toLowerCase()),
    );
    const injection = this.#pack.safetyPolicy.promptInjectionSignals.some(
      (signal) => normalized.includes(signal.toLowerCase()),
    );
    const followUpQuestion = unsafe
      ? "Can you tell a trusted adult who can help keep everyone safe?"
      : injection
        ? "What safe question are you genuinely curious about?"
        : "What do you already think might be true?";
    const responseLead = unsafe
      ? this.#pack.safetyPolicy.unsafeResponseLead
      : injection
        ? this.#pack.safetyPolicy.promptInjectionResponseLead
        : "I cannot verify open-world facts in the zero-credit Sandbox, but we can reason about your question together.";
    return {
      value: SandboxTurnSchema.parse({
        learner_id: request.learnerId,
        learner_question: request.learnerQuestion,
        language_mode: languageMode,
        certainty: "low",
        safety_status: unsafe || injection ? "redirect" : "safe",
        spoken_response: `${responseLead} ${followUpQuestion}`,
        follow_up_question: followUpQuestion,
        should_end_session: false,
      }),
    };
  }
}
