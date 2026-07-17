import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CurriculumSourceBriefDraftSchema,
  CurriculumSourceBriefSchema,
} from "../compiler/schema.js";

function argument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing required argument ${flag}.`);
  return value;
}

const sourcePath = resolve(argument("--source"));
const document = JSON.parse(readFileSync(sourcePath, "utf8")) as unknown;
const draft = CurriculumSourceBriefDraftSchema.parse(document);
const approved = CurriculumSourceBriefSchema.safeParse(draft);

console.log(`Valid curriculum source brief: ${draft.id}`);
console.log(`Subject: ${draft.subject}`);
console.log(`Sources: ${draft.sourceMaterials.length}`);
console.log(`Required concepts: ${draft.requiredConcepts.length}`);
console.log(`Human review: ${draft.review.status}`);

if (!approved.success) {
  console.log(
    "Compilation is locked until a human approval receipt covers every listed source URL.",
  );
  process.exitCode = 2;
} else {
  console.log(
    `Compilation unlocked by ${approved.data.review.reviewedBy} at ${approved.data.review.reviewedAt}.`,
  );
}
