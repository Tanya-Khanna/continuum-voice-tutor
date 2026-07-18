import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { LearningRepository } from "../domain/learner.js";
import {
  GuardianAuthorizationSchema,
  type GuardianAuthorization,
} from "../domain/guardian.js";
import { hashPhoneNumber } from "../domain/identity.js";
import { LearnerCodeSchema } from "../domain/portable-identity.js";

function fingerprint(code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`continuum-guardian-code:${code}`)
    .digest("hex");
}

function derive(code: string, salt: string, secret: string): string {
  return scryptSync(`${secret}:${code}`, salt, 32).toString("hex");
}

function equalHashes(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class GuardianAccessService {
  readonly #repository: LearningRepository;
  readonly #secret: string;
  readonly #phoneHashSecret: string;
  readonly #clock: () => Date;
  readonly #makeCode: () => string;

  constructor(options: {
    repository: LearningRepository;
    secret: string;
    phoneHashSecret: string;
    clock?: () => Date;
    makeCode?: () => string;
  }) {
    if (options.secret.length < 16) {
      throw new Error("Guardian-code secret must be at least 16 characters.");
    }
    this.#repository = options.repository;
    this.#secret = options.secret;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeCode =
      options.makeCode ?? (() => randomInt(0, 1_000_000).toString().padStart(6, "0"));
  }

  issue(options: {
    learnerId: string;
    guardianPhoneNumber: string;
    smsAllowed: boolean;
    proactiveCallsAllowed: boolean;
  }): string {
    if (!this.#repository.findLearner(options.learnerId)) {
      throw new Error(`Unknown learner ${options.learnerId}.`);
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const code = LearnerCodeSchema.parse(this.#makeCode());
      const codeFingerprint = fingerprint(code, this.#secret);
      if (this.#repository.findGuardianAuthorizationByFingerprint(codeFingerprint)) {
        continue;
      }
      const salt = randomBytes(16).toString("base64url");
      const now = this.#clock().toISOString();
      this.#repository.saveGuardianAuthorization(
        GuardianAuthorizationSchema.parse({
          learnerId: options.learnerId,
          guardianPhoneHash: hashPhoneNumber(
            options.guardianPhoneNumber,
            this.#phoneHashSecret,
          ),
          codeFingerprint,
          codeHash: derive(code, salt, this.#secret),
          salt,
          smsAllowed: options.smsAllowed,
          proactiveCallsAllowed: options.proactiveCallsAllowed,
          createdAt: now,
          updatedAt: now,
        }),
      );
      return code;
    }
    throw new Error("Unable to allocate a guardian code.");
  }

  verify(options: {
    code: string;
    guardianPhoneNumber: string;
  }): GuardianAuthorization | undefined {
    const code = LearnerCodeSchema.safeParse(options.code);
    if (!code.success) return undefined;
    const authorization =
      this.#repository.findGuardianAuthorizationByFingerprint(
        fingerprint(code.data, this.#secret),
      );
    if (!authorization) return undefined;
    const phoneHash = hashPhoneNumber(
      options.guardianPhoneNumber,
      this.#phoneHashSecret,
    );
    if (phoneHash !== authorization.guardianPhoneHash) return undefined;
    return equalHashes(
      derive(code.data, authorization.salt, this.#secret),
      authorization.codeHash,
    )
      ? authorization
      : undefined;
  }
}
