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

export class OfflineTeachingEngine implements TeachingEngine {
  readonly modelRoute = "offline";
  readonly #engine: CurriculumTeachingEngine;

  constructor(
    pack: CurriculumPack,
    languageDetector: LanguageDetector = new ConfiguredLanguageDetector(pack.deployment),
  ) {
    this.#engine = new CurriculumTeachingEngine({ pack, languageDetector });
  }

  teach(request: TeachingRequest): Promise<TeachingTurn> {
    return this.#engine.teach(request);
  }

  summarizeHistory(
    request: LearningHistoryRequest,
  ): Promise<LearningHistoryResponse> {
    return this.#engine.summarizeHistory(request);
  }
}
