import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fractionsPack } from "../curriculum/fractions.pack.js";
import {
  CurriculumPackSchema,
  type CurriculumPack,
} from "../curriculum/schema.js";

export function loadCurriculumPack(path?: string): CurriculumPack {
  if (!path) return fractionsPack;

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
