import { type LanguageMode, MasteryStatusSchema } from "./teaching.js";
import type { z } from "zod";

export interface LearnerProfile {
  id: string;
  name?: string;
  preferredLanguage: Exclude<LanguageMode, "auto">;
  currentConcept: string;
  lastMastery: z.infer<typeof MasteryStatusSchema>;
  updatedAt: string;
}

export interface LearnerRepository {
  find(id: string): Promise<LearnerProfile | undefined>;
  save(profile: LearnerProfile): Promise<void>;
}

export class InMemoryLearnerRepository implements LearnerRepository {
  readonly #learners = new Map<string, LearnerProfile>();

  async find(id: string): Promise<LearnerProfile | undefined> {
    return this.#learners.get(id);
  }

  async save(profile: LearnerProfile): Promise<void> {
    this.#learners.set(profile.id, profile);
  }
}
