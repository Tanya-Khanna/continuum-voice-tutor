import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fractionsPack } from "../curriculum/fractions.pack.js";
import { CurriculumCatalog } from "../curriculum/catalog.js";
import {
  CurriculumPackSchema,
  type CurriculumPack,
} from "../curriculum/schema.js";

export function loadCurriculumPack(path?: string): CurriculumPack {
  if (!path) return fractionsPack;
  if (path === `builtin:${fractionsPack.id}`) return fractionsPack;

  const absolutePath = resolve(path);
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read curriculum pack ${absolutePath}: ${message}`);
  }
  return CurriculumPackSchema.parse(document);
}

export function curriculumCatalogOptions(environment: {
  NOMAD_CURRICULUM_PATH?: string | undefined;
  NOMAD_CURRICULUM_PATHS?: readonly string[] | undefined;
}): { paths?: readonly string[]; legacyPath?: string } {
  return {
    ...(environment.NOMAD_CURRICULUM_PATHS
      ? { paths: environment.NOMAD_CURRICULUM_PATHS }
      : {}),
    ...(environment.NOMAD_CURRICULUM_PATH
      ? { legacyPath: environment.NOMAD_CURRICULUM_PATH }
      : {}),
  };
}

export function loadCurriculumCatalog(options: {
  paths?: readonly string[];
  legacyPath?: string;
} = {}): CurriculumCatalog {
  if (options.paths && options.legacyPath) {
    throw new Error(
      "Configure NOMAD_CURRICULUM_PATH or NOMAD_CURRICULUM_PATHS, not both.",
    );
  }
  if (options.paths) {
    if (options.paths.length === 0) {
      throw new Error("NOMAD_CURRICULUM_PATHS must contain at least one path.");
    }
    return new CurriculumCatalog(
      options.paths.map((path) => loadCurriculumPack(path)),
    );
  }
  return new CurriculumCatalog([loadCurriculumPack(options.legacyPath)]);
}
