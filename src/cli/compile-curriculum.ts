import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { OpenAICurriculumCompiler } from "../compiler/openai-curriculum-compiler.js";
import {
  CurriculumSourceBriefDraftSchema,
  CurriculumSourceBriefSchema,
} from "../compiler/schema.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";

function argument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing required argument ${flag}.`);
  return value;
}

const sourcePath = resolve(argument("--source"));
const outputPath = resolve(argument("--out"));
const environment = loadEnvironment();
const sourceDocument = JSON.parse(readFileSync(sourcePath, "utf8")) as unknown;
const draftBrief = CurriculumSourceBriefDraftSchema.parse(sourceDocument);
const approvedBrief = CurriculumSourceBriefSchema.safeParse(draftBrief);
if (!approvedBrief.success) {
  throw new Error(
    `Curriculum source brief ${draftBrief.id} is pending human review. Run curriculum:brief:check and add an approval receipt before spending model credit.`,
  );
}
const sourceBrief = approvedBrief.data;
const compiler = new OpenAICurriculumCompiler({
  apiKey: requireOpenAIKey(environment),
  compilerModel: environment.OPENAI_COMPILER_MODEL,
  verifierModel: environment.OPENAI_VERIFIER_MODEL,
});

console.log(`Compiling reviewed source brief ${sourceBrief.id}...`);
const pack = await compiler.compile(sourceBrief);
console.log("Running independent verifier pass...");
const verification = await compiler.verify(sourceBrief, pack);
if (!verification.approved || verification.issues.some((issue) => issue.severity === "error")) {
  for (const issue of verification.issues) {
    console.error(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
  }
  throw new Error("Curriculum verification failed; no pack was written.");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(`Frozen verified pack written to ${outputPath}.`);
