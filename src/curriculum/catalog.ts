import type { CurriculumPack } from "./schema.js";

export interface CurriculumSubjectOption {
  id: string;
  subject: string;
  pack: CurriculumPack;
}

function normalizedSubject(subject: string): string {
  return subject.trim().toLocaleLowerCase("en-US");
}

export class CurriculumCatalog {
  readonly #options: readonly CurriculumSubjectOption[];
  readonly #bySubject: ReadonlyMap<string, CurriculumSubjectOption>;
  readonly #byPackId: ReadonlyMap<string, CurriculumSubjectOption>;

  constructor(packs: readonly CurriculumPack[]) {
    if (packs.length === 0) {
      throw new Error("A curriculum catalog requires at least one pack.");
    }

    const options: CurriculumSubjectOption[] = [];
    const bySubject = new Map<string, CurriculumSubjectOption>();
    const byPackId = new Map<string, CurriculumSubjectOption>();
    const deployment = packs[0]!.deployment;
    for (const pack of packs) {
      if (
        pack.deployment.countryCode !== deployment.countryCode ||
        pack.deployment.grade !== deployment.grade
      ) {
        throw new Error(
          `Curriculum pack ${pack.id} does not match deployment ${deployment.countryCode} Grade ${deployment.grade}.`,
        );
      }
      if (byPackId.has(pack.id)) {
        throw new Error(`Duplicate curriculum pack id ${pack.id}.`);
      }
      const key = normalizedSubject(pack.deployment.subject);
      if (bySubject.has(key)) {
        throw new Error(
          `Duplicate curriculum subject ${pack.deployment.subject}.`,
        );
      }
      const option = {
        id: pack.id,
        subject: pack.deployment.subject.trim(),
        pack,
      };
      options.push(option);
      bySubject.set(key, option);
      byPackId.set(pack.id, option);
    }

    this.#options = Object.freeze(options);
    this.#bySubject = bySubject;
    this.#byPackId = byPackId;
  }

  get defaultOption(): CurriculumSubjectOption {
    return this.#options[0]!;
  }

  list(): readonly CurriculumSubjectOption[] {
    return this.#options;
  }

  subjects(): string[] {
    return this.#options.map((option) => option.subject);
  }

  findBySubject(subject: string): CurriculumSubjectOption | undefined {
    return this.#bySubject.get(normalizedSubject(subject));
  }

  requireBySubject(subject: string): CurriculumSubjectOption {
    const option = this.findBySubject(subject);
    if (!option) {
      throw new Error(
        `Unknown guided subject ${subject}. Available subjects: ${this.subjects().join(", ")}.`,
      );
    }
    return option;
  }

  requireByPackId(packId: string): CurriculumSubjectOption {
    const option = this.#byPackId.get(packId);
    if (!option) throw new Error(`Unknown curriculum pack ${packId}.`);
    return option;
  }
}
