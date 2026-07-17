import type { CurriculumPack } from "../curriculum/schema.js";
import {
  ResolvedLanguageModeSchema,
  type LanguageMode,
} from "../domain/teaching.js";

export interface LanguageDetector {
  detect(answer: string, requested: LanguageMode): string;
}

export class ConfiguredLanguageDetector implements LanguageDetector {
  readonly #defaultLanguage: string;
  readonly #hints: CurriculumPack["deployment"]["offlineLanguageHints"];

  constructor(deployment: CurriculumPack["deployment"]) {
    this.#defaultLanguage = deployment.defaultLanguage;
    this.#hints = deployment.offlineLanguageHints;
  }

  detect(answer: string, requested: LanguageMode): string {
    const normalized = answer.toLowerCase();
    const match = this.#hints.find(
      (hint) =>
        hint.signals.some((signal) => normalized.includes(signal.toLowerCase())) ||
        hint.patterns.some((pattern) => new RegExp(pattern, "u").test(answer)),
    );
    return ResolvedLanguageModeSchema.parse(
      match?.languageMode ??
        (requested === "auto" ? this.#defaultLanguage : requested),
    );
  }
}
