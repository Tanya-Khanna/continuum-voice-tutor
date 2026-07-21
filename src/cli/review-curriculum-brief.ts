import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  SOURCE_REVIEW_CONFIRMATION,
  approveCurriculumSourceBrief,
} from "../compiler/release-workflow.js";
import { CurriculumSourceBriefDraftSchema } from "../compiler/schema.js";

function argument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing required argument ${flag}.`);
  return value;
}

function repeatedArguments(flag: string): string[] {
  return process.argv.flatMap((value, index) =>
    value === flag && process.argv[index + 1]?.trim()
      ? [process.argv[index + 1]!.trim()]
      : [],
  );
}

const sourcePath = resolve(argument("--source"));
const outputPath = resolve(argument("--out"));
if (sourcePath === outputPath) {
  throw new Error("Write an approved copy; never overwrite the pending draft.");
}
if (existsSync(outputPath)) {
  throw new Error(`Approval output already exists: ${outputPath}`);
}
const draft = CurriculumSourceBriefDraftSchema.parse(
  JSON.parse(readFileSync(sourcePath, "utf8")) as unknown,
);

console.log(`Reviewing ${draft.subject}: ${draft.id}`);
for (const [index, source] of draft.sourceMaterials.entries()) {
  console.log(`${index + 1}. ${source.title}`);
  console.log(`   ${source.url}`);
  console.log(`   Scope: ${source.themes.join("; ")}`);
}
console.log("This command records a human review; it does not inspect sources for you.");

const approved = approveCurriculumSourceBrief({
  draft,
  reviewedBy: argument("--reviewed-by"),
  reviewedAt: new Date().toISOString(),
  scopeNotes: repeatedArguments("--scope-note"),
  confirmation: argument("--confirm"),
});
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(approved, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(`Approval receipt written create-only to ${outputPath}.`);
console.log(`Confirmation used: ${SOURCE_REVIEW_CONFIRMATION}`);
