import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { OpenAICurriculumCompiler } from "../compiler/openai-curriculum-compiler.js";
import { createCompileReceipt } from "../compiler/release-workflow.js";
import { CurriculumSourceBriefSchema } from "../compiler/schema.js";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import { CurriculumPackSchema } from "../curriculum/schema.js";

function argument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing required argument ${flag}.`);
  return value;
}

const sourcePath = resolve(argument("--source"));
const candidatePath = resolve(argument("--candidate"));
const receiptPath = resolve(argument("--out"));
if (existsSync(receiptPath)) {
  throw new Error(`Verification output already exists: ${receiptPath}`);
}
const brief = CurriculumSourceBriefSchema.parse(
  JSON.parse(readFileSync(sourcePath, "utf8")) as unknown,
);
const pack = CurriculumPackSchema.parse(
  JSON.parse(readFileSync(candidatePath, "utf8")) as unknown,
);
const environment = loadEnvironment();
const compiler = new OpenAICurriculumCompiler({
  apiKey: requireOpenAIKey(environment),
  compilerModel: environment.OPENAI_COMPILER_MODEL,
  verifierModel: environment.OPENAI_VERIFIER_MODEL,
});

console.log(`Independently verifying candidate ${pack.id}...`);
const verification = await compiler.verify(brief, pack);
for (const issue of verification.issues) {
  console.error(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
}
if (
  !verification.approved ||
  verification.issues.some((issue) => issue.severity === "error")
) {
  throw new Error("Curriculum verification failed; no receipt was written.");
}
const receipt = createCompileReceipt({
  brief,
  pack,
  verification,
  verifiedAt: new Date().toISOString(),
});
mkdirSync(dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(`Digest-bound verification receipt written to ${receiptPath}.`);
