import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { OpenAICurriculumCompiler } from "../compiler/openai-curriculum-compiler.js";
import { createCompileReceipt } from "../compiler/release-workflow.js";
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
const receiptPath = resolve(
  process.argv.includes("--verification-out")
    ? argument("--verification-out")
    : `${outputPath}.verification.json`,
);
for (const path of [outputPath, receiptPath]) {
  if (existsSync(path)) throw new Error(`Compiler output already exists: ${path}`);
}
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
let pack = await compiler.compile(sourceBrief);
let verification;
for (let verifierRound = 1; verifierRound <= 3; verifierRound += 1) {
  console.log(`Running independent verifier pass ${verifierRound}...`);
  verification = await compiler.verify(sourceBrief, pack);
  const errors = verification.issues.filter((issue) => issue.severity === "error");
  if (verification.approved && errors.length === 0) break;
  for (const issue of verification.issues) {
    console.error(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
  }
  if (verifierRound === 3) {
    throw new Error("Curriculum verification failed after three passes; no pack was written.");
  }
  console.log("Regenerating the candidate from verifier feedback...");
  pack = await compiler.compile(
    sourceBrief,
    verification.issues.map(
      (issue) =>
        `${issue.severity} ${issue.code}${issue.conceptId ? ` for ${issue.conceptId}` : ""}: ${issue.message}`,
    ),
  );
}
if (!verification) {
  throw new Error("Curriculum verification produced no result.");
}
const compileReceipt = createCompileReceipt({
  brief: sourceBrief,
  pack,
  verification,
  verifiedAt: new Date().toISOString(),
});

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(receiptPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
writeFileSync(receiptPath, `${JSON.stringify(compileReceipt, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(`Model-verified candidate pack written to ${outputPath}.`);
console.log(`Verification receipt written to ${receiptPath}.`);
console.log("A human builder spot-check is still required before freezing this pack.");
