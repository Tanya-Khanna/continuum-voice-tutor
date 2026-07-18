import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import type { LearnerProfile, LearningRepository } from "./learner.js";
import { hashPhoneNumber } from "./identity.js";

export const LearnerCodeSchema = z.string().regex(/^\d{6}$/u);

export const LearnerAccessCodeSchema = z.object({
  learnerId: z.string().min(1),
  codeFingerprint: z.string().length(64),
  codeHash: z.string().length(64),
  salt: z.string().min(16),
  createdAt: z.string().datetime(),
  rotatedAt: z.string().datetime().nullable(),
});

export const LearnerCodeAttemptSchema = z.object({
  id: z.string().min(1),
  codeFingerprint: z.string().length(64),
  sourcePhoneHash: z.string().length(64),
  succeeded: z.boolean(),
  createdAt: z.string().datetime(),
});

export type LearnerAccessCode = z.infer<typeof LearnerAccessCodeSchema>;
export type LearnerCodeAttempt = z.infer<typeof LearnerCodeAttemptSchema>;

export type PortableCodeVerification =
  | { status: "matched"; learner: LearnerProfile }
  | { status: "invalid" }
  | { status: "blocked"; retryAfterSeconds: number };

function codeFingerprint(code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`continuum-learner-code:${code}`)
    .digest("hex");
}

function deriveCodeHash(code: string, salt: string, secret: string): string {
  return scryptSync(`${secret}:${code}`, salt, 32).toString("hex");
}

function safeHashEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export class PortableIdentityService {
  readonly #repository: LearningRepository;
  readonly #secret: string;
  readonly #phoneHashSecret: string;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #makeCode: () => string;

  constructor(options: {
    repository: LearningRepository;
    secret: string;
    phoneHashSecret?: string;
    clock?: () => Date;
    makeId?: () => string;
    makeCode?: () => string;
  }) {
    if (options.secret.length < 16) {
      throw new Error("Portable learner-code secret must be at least 16 characters.");
    }
    this.#repository = options.repository;
    this.#secret = options.secret;
    this.#phoneHashSecret = options.phoneHashSecret ?? options.secret;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? (() => randomBytes(16).toString("hex"));
    this.#makeCode =
      options.makeCode ?? (() => randomInt(0, 1_000_000).toString().padStart(6, "0"));
  }

  issue(learnerId: string): string {
    if (!this.#repository.findLearner(learnerId)) {
      throw new Error(`Cannot issue a code for unknown learner ${learnerId}.`);
    }
    const existing = this.#repository.findLearnerAccessCode(learnerId);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const code = LearnerCodeSchema.parse(this.#makeCode());
      const fingerprint = codeFingerprint(code, this.#secret);
      if (this.#repository.findLearnerAccessCodeByFingerprint(fingerprint)) {
        continue;
      }
      const now = this.#clock().toISOString();
      const salt = randomBytes(16).toString("base64url");
      this.#repository.saveLearnerAccessCode(
        LearnerAccessCodeSchema.parse({
          learnerId,
          codeFingerprint: fingerprint,
          codeHash: deriveCodeHash(code, salt, this.#secret),
          salt,
          createdAt: existing?.createdAt ?? now,
          rotatedAt: existing ? now : null,
        }),
      );
      return code;
    }
    throw new Error("Unable to allocate a unique learner code.");
  }

  hasCode(learnerId: string): boolean {
    return Boolean(this.#repository.findLearnerAccessCode(learnerId));
  }

  verify(options: {
    code: string;
    sourcePhoneNumber: string;
    attemptsThisCall: number;
  }): PortableCodeVerification {
    if (options.attemptsThisCall >= 3) {
      return { status: "blocked", retryAfterSeconds: 600 };
    }
    const parsedCode = LearnerCodeSchema.safeParse(options.code);
    const candidateCode = parsedCode.success ? parsedCode.data : "000000";
    const fingerprint = codeFingerprint(candidateCode, this.#secret);
    const sourcePhoneHash = hashPhoneNumber(
      options.sourcePhoneNumber,
      this.#phoneHashSecret,
    );
    const now = this.#clock();
    const since = new Date(now.getTime() - 10 * 60_000).toISOString();
    const recentFailures = this.#repository.countRecentLearnerCodeFailures({
      sourcePhoneHash,
      codeFingerprint: fingerprint,
      since,
    });
    if (recentFailures >= 10) {
      return { status: "blocked", retryAfterSeconds: 600 };
    }

    const record = parsedCode.success
      ? this.#repository.findLearnerAccessCodeByFingerprint(fingerprint)
      : undefined;
    const validHash = record
      ? deriveCodeHash(candidateCode, record.salt, this.#secret)
      : "0".repeat(64);
    const succeeded = Boolean(
      record && safeHashEqual(validHash, record.codeHash),
    );
    this.#repository.appendLearnerCodeAttempt(
      LearnerCodeAttemptSchema.parse({
        id: this.#makeId(),
        codeFingerprint: fingerprint,
        sourcePhoneHash,
        succeeded,
        createdAt: now.toISOString(),
      }),
    );
    if (!succeeded || !record) return { status: "invalid" };
    const learner = this.#repository.findLearner(record.learnerId);
    if (
      learner &&
      learner.phoneHash !== sourcePhoneHash &&
      this.#repository.findResumableLesson(learner.id)
    ) {
      this.#repository.appendProductMetric({
        id: this.#makeId(),
        name: "cross_phone_resumed",
        learnerId: learner.id,
        sessionId: this.#repository.findResumableLesson(learner.id)?.id ?? null,
        channel: "dtmf",
        accessMode: "unknown",
        numericValue: null,
        synthetic: false,
        createdAt: now.toISOString(),
      });
    }
    return learner ? { status: "matched", learner } : { status: "invalid" };
  }
}
