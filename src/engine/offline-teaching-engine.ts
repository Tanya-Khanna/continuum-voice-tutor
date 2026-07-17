import type { CurriculumPack } from "../curriculum/schema.js";
import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";
import {
  ConfiguredLanguageDetector,
  type LanguageDetector,
} from "../language/language-detector.js";
import { CurriculumTeachingEngine } from "./curriculum-teaching-engine.js";
import type { TeachingEngine } from "./teaching-engine.js";

export class OfflineTeachingEngine implements TeachingEngine {
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
}
