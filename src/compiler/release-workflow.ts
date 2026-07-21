import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CurriculumPackSchema,
  type CurriculumPack,
} from "../curriculum/schema.js";
import { assertRequiredVocabulary } from "./openai-curriculum-compiler.js";
import {
  CurriculumSourceBriefDraftSchema,
  CurriculumSourceBriefSchema,
  CurriculumVerificationSchema,
  type CurriculumSourceBrief,
  type CurriculumSourceBriefDraft,
} from "./schema.js";

export const SOURCE_REVIEW_CONFIRMATION = "I_REVIEWED_EVERY_SOURCE";
export const PACK_SPOT_CHECK_CONFIRMATION = "I_SPOT_CHECKED_THIS_PACK";

export const CurriculumCompileReceiptSchema = z.object({
  sourceBriefId: z.string().min(1),
  packId: z.string().min(1),
  packVersion: z.string().min(1),
  sourceBriefSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  packSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  verifiedAt: z.string().datetime(),
  verification: CurriculumVerificationSchema,
});

export const CurriculumReleaseReceiptSchema = z.object({
  sourceBriefId: z.string().min(1),
  packId: z.string().min(1),
  packVersion: z.string().min(1),
  subject: z.string().min(1),
  sourceBriefSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  packSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  compileReceiptSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  releasedBy: z.string().trim().min(1),
  releasedAt: z.string().datetime(),
  checklist: z.object({
    sourceScope: z.literal(true),
    factualAnswers: z.literal(true),
    voiceAndOneQuestion: z.literal(true),
    keypadAndSms: z.literal(true),
    safetyAndOriginality: z.literal(true),
  }),
  notes: z.array(z.string().min(1)).min(1),
});

export const CurriculumReleaseTargetSchema = z.object({
  id: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/u),
  grade: z.number().int().positive(),
  entries: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("builtin"),
          subject: z.string().min(1),
          packId: z.string().min(1),
        }),
        z.object({
          kind: z.literal("compiled"),
          subject: z.string().min(1),
          sourceBrief: z.string().min(1),
          candidate: z.string().min(1),
          compileReceipt: z.string().min(1),
          frozenPack: z.string().min(1),
          releaseReceipt: z.string().min(1),
        }),
      ]),
    )
    .min(1),
});

export type CurriculumCompileReceipt = z.infer<
  typeof CurriculumCompileReceiptSchema
>;
export type CurriculumReleaseReceipt = z.infer<
  typeof CurriculumReleaseReceiptSchema
>;
export type CurriculumReleaseTarget = z.infer<
  typeof CurriculumReleaseTargetSchema
>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function artifactSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function approveCurriculumSourceBrief(options: {
  draft: CurriculumSourceBriefDraft;
  reviewedBy: string;
  reviewedAt: string;
  scopeNotes: readonly string[];
  confirmation: string;
}): CurriculumSourceBrief {
  const draft = CurriculumSourceBriefDraftSchema.parse(options.draft);
  if (draft.review.status === "approved") {
    throw new Error(`Source brief ${draft.id} already has an approval receipt.`);
  }
  if (options.confirmation !== SOURCE_REVIEW_CONFIRMATION) {
    throw new Error(
      `Human source review requires the exact confirmation ${SOURCE_REVIEW_CONFIRMATION}.`,
    );
  }
  return CurriculumSourceBriefSchema.parse({
    ...draft,
    review: {
      status: "approved",
      reviewedBy: options.reviewedBy.trim(),
      reviewedAt: options.reviewedAt,
      reviewedSourceUrls: draft.sourceMaterials.map((source) => source.url),
      scopeNotes: options.scopeNotes.map((note) => note.trim()).filter(Boolean),
    },
  });
}

export function createCompileReceipt(options: {
  brief: CurriculumSourceBrief;
  pack: CurriculumPack;
  verification: z.infer<typeof CurriculumVerificationSchema>;
  verifiedAt: string;
}): CurriculumCompileReceipt {
  const brief = CurriculumSourceBriefSchema.parse(options.brief);
  const pack = CurriculumPackSchema.parse(options.pack);
  const verification = CurriculumVerificationSchema.parse(options.verification);
  if (!verification.approved) {
    throw new Error("A rejected curriculum verification cannot create a receipt.");
  }
  if (verification.issues.some((issue) => issue.severity === "error")) {
    throw new Error("A curriculum verification with errors cannot create a receipt.");
  }
  assertPackMatchesBrief(brief, pack);
  return CurriculumCompileReceiptSchema.parse({
    sourceBriefId: brief.id,
    packId: pack.id,
    packVersion: pack.version,
    sourceBriefSha256: artifactSha256(brief),
    packSha256: artifactSha256(pack),
    verifiedAt: options.verifiedAt,
    verification,
  });
}

export function createCurriculumReleaseReceipt(options: {
  brief: CurriculumSourceBrief;
  pack: CurriculumPack;
  compileReceipt: CurriculumCompileReceipt;
  releasedBy: string;
  releasedAt: string;
  notes: readonly string[];
  confirmation: string;
}): CurriculumReleaseReceipt {
  const brief = CurriculumSourceBriefSchema.parse(options.brief);
  const pack = CurriculumPackSchema.parse(options.pack);
  const compileReceipt = CurriculumCompileReceiptSchema.parse(
    options.compileReceipt,
  );
  if (options.confirmation !== PACK_SPOT_CHECK_CONFIRMATION) {
    throw new Error(
      `Human pack spot-check requires the exact confirmation ${PACK_SPOT_CHECK_CONFIRMATION}.`,
    );
  }
  assertPackMatchesBrief(brief, pack);
  assertCompileReceipt(brief, pack, compileReceipt);
  return CurriculumReleaseReceiptSchema.parse({
    sourceBriefId: brief.id,
    packId: pack.id,
    packVersion: pack.version,
    subject: pack.deployment.subject,
    sourceBriefSha256: artifactSha256(brief),
    packSha256: artifactSha256(pack),
    compileReceiptSha256: artifactSha256(compileReceipt),
    releasedBy: options.releasedBy.trim(),
    releasedAt: options.releasedAt,
    checklist: {
      sourceScope: true,
      factualAnswers: true,
      voiceAndOneQuestion: true,
      keypadAndSms: true,
      safetyAndOriginality: true,
    },
    notes: options.notes.map((note) => note.trim()).filter(Boolean),
  });
}

export function assertPackRelease(options: {
  brief: CurriculumSourceBrief;
  pack: CurriculumPack;
  compileReceipt: CurriculumCompileReceipt;
  releaseReceipt: CurriculumReleaseReceipt;
}): void {
  const brief = CurriculumSourceBriefSchema.parse(options.brief);
  const pack = CurriculumPackSchema.parse(options.pack);
  const compileReceipt = CurriculumCompileReceiptSchema.parse(
    options.compileReceipt,
  );
  const releaseReceipt = CurriculumReleaseReceiptSchema.parse(
    options.releaseReceipt,
  );
  assertPackMatchesBrief(brief, pack);
  assertCompileReceipt(brief, pack, compileReceipt);
  const expected = {
    sourceBriefId: brief.id,
    packId: pack.id,
    packVersion: pack.version,
    subject: pack.deployment.subject,
    sourceBriefSha256: artifactSha256(brief),
    packSha256: artifactSha256(pack),
    compileReceiptSha256: artifactSha256(compileReceipt),
  };
  for (const [field, value] of Object.entries(expected)) {
    if (releaseReceipt[field as keyof typeof expected] !== value) {
      throw new Error(`Curriculum release receipt does not match ${field}.`);
    }
  }
}

function assertPackMatchesBrief(
  brief: CurriculumSourceBrief,
  pack: CurriculumPack,
): void {
  if (
    pack.deployment.countryCode !== brief.deployment.countryCode ||
    pack.deployment.grade !== brief.deployment.grade ||
    pack.deployment.subject !== brief.deployment.subject
  ) {
    throw new Error("Curriculum pack deployment does not match its source brief.");
  }
  if (pack.provenance.method !== "compiled") {
    throw new Error("The compiler release workflow accepts compiled packs only.");
  }
  const sourceUrls = pack.provenance.sourceMaterials.map((source) => source.url);
  const briefUrls = brief.sourceMaterials.map((source) => source.url);
  if (
    sourceUrls.length !== briefUrls.length ||
    sourceUrls.some((url) => !briefUrls.includes(url))
  ) {
    throw new Error("Curriculum pack provenance does not match its source brief.");
  }
  assertRequiredVocabulary(brief, pack);
}

function assertCompileReceipt(
  brief: CurriculumSourceBrief,
  pack: CurriculumPack,
  receipt: CurriculumCompileReceipt,
): void {
  const expected = {
    sourceBriefId: brief.id,
    packId: pack.id,
    packVersion: pack.version,
    sourceBriefSha256: artifactSha256(brief),
    packSha256: artifactSha256(pack),
  };
  for (const [field, value] of Object.entries(expected)) {
    if (receipt[field as keyof typeof expected] !== value) {
      throw new Error(`Curriculum compile receipt does not match ${field}.`);
    }
  }
  if (!receipt.verification.approved) {
    throw new Error("Curriculum compile receipt is not approved.");
  }
}
