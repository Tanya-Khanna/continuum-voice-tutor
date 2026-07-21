import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  CurriculumCompileReceiptSchema,
  PACK_SPOT_CHECK_CONFIRMATION,
  createCurriculumReleaseReceipt,
} from "../compiler/release-workflow.js";
import { CurriculumSourceBriefSchema } from "../compiler/schema.js";
import { CurriculumPackSchema } from "../curriculum/schema.js";

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

const brief = CurriculumSourceBriefSchema.parse(
  JSON.parse(readFileSync(resolve(argument("--source")), "utf8")) as unknown,
);
const candidate = CurriculumPackSchema.parse(
  JSON.parse(readFileSync(resolve(argument("--candidate")), "utf8")) as unknown,
);
const compileReceipt = CurriculumCompileReceiptSchema.parse(
  JSON.parse(
    readFileSync(resolve(argument("--compile-receipt")), "utf8"),
  ) as unknown,
);
const outputPath = resolve(argument("--out"));
const releaseReceiptPath = resolve(argument("--release-receipt-out"));
for (const path of [outputPath, releaseReceiptPath]) {
  if (existsSync(path)) throw new Error(`Release output already exists: ${path}`);
}

const releaseReceipt = createCurriculumReleaseReceipt({
  brief,
  pack: candidate,
  compileReceipt,
  releasedBy: argument("--released-by"),
  releasedAt: new Date().toISOString(),
  notes: repeatedArguments("--note"),
  confirmation: argument("--confirm"),
});

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(releaseReceiptPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
writeFileSync(
  releaseReceiptPath,
  `${JSON.stringify(releaseReceipt, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
console.log(`Frozen pack written create-only to ${outputPath}.`);
console.log(`Release receipt written to ${releaseReceiptPath}.`);
console.log(`Confirmation used: ${PACK_SPOT_CHECK_CONFIRMATION}`);
