import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  CurriculumCompileReceiptSchema,
  CurriculumReleaseReceiptSchema,
  CurriculumReleaseTargetSchema,
  assertPackRelease,
} from "../compiler/release-workflow.js";
import { CurriculumSourceBriefSchema } from "../compiler/schema.js";
import { CurriculumCatalog } from "../curriculum/catalog.js";
import { fractionsPack } from "../curriculum/fractions.pack.js";
import { CurriculumPackSchema, type CurriculumPack } from "../curriculum/schema.js";

function argument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing required argument ${flag}.`);
  return value;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

const targetPath = resolve(argument("--target"));
const targetRoot = dirname(targetPath);
const target = CurriculumReleaseTargetSchema.parse(readJson(targetPath));
const packs: CurriculumPack[] = [];
const runtimePaths: string[] = [];
let pending = 0;

for (const entry of target.entries) {
  if (entry.kind === "builtin") {
    if (entry.packId !== fractionsPack.id || entry.subject !== fractionsPack.deployment.subject) {
      throw new Error(`Unknown built-in release pack ${entry.packId}.`);
    }
    packs.push(fractionsPack);
    runtimePaths.push(`builtin:${fractionsPack.id}`);
    console.log(`READY ${entry.subject}: built-in reviewed flagship ${entry.packId}`);
    continue;
  }

  const paths = Object.fromEntries(
    ([
      "sourceBrief",
      "candidate",
      "compileReceipt",
      "frozenPack",
      "releaseReceipt",
    ] as const).map((field) => [field, resolve(targetRoot, entry[field])]),
  ) as Record<
    "sourceBrief" | "candidate" | "compileReceipt" | "frozenPack" | "releaseReceipt",
    string
  >;
  const missing = Object.entries(paths)
    .filter(([, path]) => !existsSync(path))
    .map(([field]) => field);
  if (missing.length > 0) {
    pending += 1;
    console.log(`PENDING ${entry.subject}: missing ${missing.join(", ")}`);
    continue;
  }

  const brief = CurriculumSourceBriefSchema.parse(readJson(paths.sourceBrief));
  const candidate = CurriculumPackSchema.parse(readJson(paths.candidate));
  const frozenPack = CurriculumPackSchema.parse(readJson(paths.frozenPack));
  if (JSON.stringify(candidate) !== JSON.stringify(frozenPack)) {
    throw new Error(`${entry.subject} frozen pack differs from its verified candidate.`);
  }
  const compileReceipt = CurriculumCompileReceiptSchema.parse(
    readJson(paths.compileReceipt),
  );
  const releaseReceipt = CurriculumReleaseReceiptSchema.parse(
    readJson(paths.releaseReceipt),
  );
  assertPackRelease({ brief, pack: frozenPack, compileReceipt, releaseReceipt });
  if (entry.subject !== frozenPack.deployment.subject) {
    throw new Error(`${entry.subject} release target points to another subject.`);
  }
  packs.push(frozenPack);
  runtimePaths.push(relative(process.cwd(), paths.frozenPack));
  console.log(`READY ${entry.subject}: ${frozenPack.id} ${frozenPack.version}`);
}

if (pending > 0) {
  console.log(`${target.id}: ${packs.length}/${target.entries.length} subjects released.`);
  process.exitCode = 2;
} else {
  const catalog = new CurriculumCatalog(packs);
  if (
    catalog.defaultOption.pack.deployment.countryCode !== target.countryCode ||
    catalog.defaultOption.pack.deployment.grade !== target.grade
  ) {
    throw new Error("Released catalog does not match the target deployment.");
  }
  console.log(`${target.id}: ${catalog.subjects().length}/${target.entries.length} subjects released.`);
  console.log(`NOMAD_CURRICULUM_PATHS=${JSON.stringify(runtimePaths)}`);
}
