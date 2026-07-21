import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import type { LearningRepository } from "../domain/learner.js";
import { CallbackJobSchema, type CallbackJob } from "../domain/callback.js";
import { hashPhoneNumber } from "../domain/identity.js";
import { buildSipTarget } from "./realtime-sip.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";

const E164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/u);

export const MissedCallWebhookSchema = z.object({
  CallSid: z.string().regex(/^CA[0-9a-fA-F]{32}$/u),
  From: E164Schema,
  To: E164Schema,
  CallStatus: z.string().min(1).optional(),
});

const TwilioCallResponseSchema = z
  .object({ sid: z.string().min(1), status: z.string().min(1) })
  .passthrough();

export const MISSED_CALL_REJECT_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>';

function encryptionKey(secret: string): Buffer {
  return createHash("sha256")
    .update(`continuum-callback-encryption:${secret}`)
    .digest();
}

export function protectCallbackDestination(phoneNumber: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(phoneNumber, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function revealCallbackDestination(payload: string, secret: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Invalid encrypted callback destination.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return E164Schema.parse(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  );
}

function relaySignature(
  phoneNumber: string,
  secret: string,
  learnerId?: string,
  durationMinutes?: 3 | 5 | 10,
): string {
  return createHmac("sha256", secret)
    .update(
      `continuum-relayed-caller:${phoneNumber}:${learnerId ?? "missed-call"}:${durationMinutes ?? "unspecified"}`,
    )
    .digest("hex");
}

export function buildCallbackSipUri(options: {
  projectId: string;
  callerNumber: string;
  relaySecret: string;
  learnerId?: string;
  durationMinutes?: 3 | 5 | 10;
}): string {
  const target = buildSipTarget(options.projectId);
  const parameters = new URLSearchParams({
    "X-Continuum-Caller": E164Schema.parse(options.callerNumber),
    ...(options.learnerId
      ? { "X-Continuum-Learner-Id": options.learnerId }
      : {}),
    ...(options.durationMinutes
      ? { "X-Continuum-Duration-Minutes": String(options.durationMinutes) }
      : {}),
    "X-Continuum-Signature": relaySignature(
      options.callerNumber,
      options.relaySecret,
      options.learnerId,
      options.durationMinutes,
    ),
  });
  return `${target}?${parameters.toString()}`;
}

export function verifiedRelayedCaller(options: {
  callerNumber: string;
  signature: string;
  relaySecret: string;
  learnerId?: string;
  durationMinutes?: 3 | 5 | 10;
}): string | undefined {
  const parsed = E164Schema.safeParse(options.callerNumber);
  if (!parsed.success) return undefined;
  const expected = Buffer.from(
    relaySignature(
      parsed.data,
      options.relaySecret,
      options.learnerId,
      options.durationMinutes,
    ),
    "utf8",
  );
  const supplied = Buffer.from(options.signature, "utf8");
  return expected.length === supplied.length &&
    cryptoTimingSafeEqual(expected, supplied)
    ? parsed.data
    : undefined;
}

function cryptoTimingSafeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function localHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  return start > end
    ? hour >= start || hour < end
    : hour >= start && hour < end;
}

export type MissedCallEnqueueResult =
  | { status: "queued"; job: CallbackJob }
  | { status: "duplicate"; job: CallbackJob }
  | { status: "blocked"; reason: string };

export class MissedCallCallbackService {
  readonly #repository: LearningRepository;
  readonly #secret: string;
  readonly #phoneHashSecret: string;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #allowedPrefixes: string[];
  readonly #timeZone: string;
  readonly #quietStartHour: number;
  readonly #quietEndHour: number;
  readonly #perNumberDailyLimit: number;
  readonly #globalDailyLimit: number;
  readonly #allowAdultDemo: boolean;

  constructor(options: {
    repository: LearningRepository;
    secret: string;
    phoneHashSecret: string;
    allowedPrefixes: string[];
    timeZone: string;
    quietStartHour: number;
    quietEndHour: number;
    perNumberDailyLimit: number;
    globalDailyLimit: number;
    allowAdultDemo: boolean;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    if (options.secret.length < 16) {
      throw new Error("Callback secret must be at least 16 characters.");
    }
    this.#repository = options.repository;
    this.#secret = options.secret;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#allowedPrefixes = options.allowedPrefixes;
    this.#timeZone = options.timeZone;
    this.#quietStartHour = options.quietStartHour;
    this.#quietEndHour = options.quietEndHour;
    this.#perNumberDailyLimit = options.perNumberDailyLimit;
    this.#globalDailyLimit = options.globalDailyLimit;
    this.#allowAdultDemo = options.allowAdultDemo;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? (() => randomBytes(16).toString("hex"));
  }

  enqueue(unparsedPayload: unknown): MissedCallEnqueueResult {
    const payload = MissedCallWebhookSchema.parse(unparsedPayload);
    const existing = this.#repository.findCallbackJobBySourceCallSid(
      payload.CallSid,
    );
    if (existing) return { status: "duplicate", job: existing };
    if (!this.#allowedPrefixes.some((prefix) => payload.From.startsWith(prefix))) {
      return { status: "blocked", reason: "country_not_allowed" };
    }
    const nowDate = this.#clock();
    const callerPhoneHash = hashPhoneNumber(
      payload.From,
      this.#phoneHashSecret,
    );
    const enrolled =
      this.#repository.listLearnersForPhone(callerPhoneHash).length > 0;
    if (!enrolled && !this.#allowAdultDemo) {
      return { status: "blocked", reason: "guardian_enrollment_required" };
    }
    // Quiet hours protect the normal learner deployment. The explicit adult
    // hackathon mode is a private test surface whose judges may be in any
    // timezone, so it suspends this deployment-level gate.
    if (
      !this.#allowAdultDemo &&
      isQuietHour(
        localHour(nowDate, this.#timeZone),
        this.#quietStartHour,
        this.#quietEndHour,
      )
    ) {
      return { status: "blocked", reason: "quiet_hours" };
    }
    const duplicateSince = new Date(
      nowDate.getTime() - 10 * 60_000,
    ).toISOString();
    const recent = this.#repository.findRecentCallbackJob({
      callerPhoneHash,
      since: duplicateSince,
    });
    if (recent) return { status: "duplicate", job: recent };
    const daySince = new Date(nowDate.getTime() - 24 * 60 * 60_000).toISOString();
    if (
      this.#repository.countCallbackJobsSince(daySince, callerPhoneHash) >=
      this.#perNumberDailyLimit
    ) {
      return { status: "blocked", reason: "number_daily_limit" };
    }
    if (
      this.#repository.countCallbackJobsSince(daySince) >= this.#globalDailyLimit
    ) {
      return { status: "blocked", reason: "global_daily_limit" };
    }
    const now = nowDate.toISOString();
    const job = CallbackJobSchema.parse({
      id: this.#makeId(),
      sourceCallSid: payload.CallSid,
      callerPhoneHash,
      encryptedCallerNumber: protectCallbackDestination(payload.From, this.#secret),
      accessMode: "missed_call",
      status: "pending",
      attempts: 0,
      claimToken: null,
      claimExpiresAt: null,
      providerCallSid: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveCallbackJob(job);
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name: "missed_call_queued",
        learnerId: null,
        sessionId: null,
        channel: "phone",
        accessMode: "missed_call",
        numericValue: null,
        synthetic: false,
        createdAt: now,
      }),
    );
    return { status: "queued", job };
  }

  destination(job: CallbackJob): string {
    return revealCallbackDestination(job.encryptedCallerNumber, this.#secret);
  }
}

export async function placeTwilioCallback(options: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  projectId: string;
  relaySecret: string;
  learnerId?: string;
  durationMinutes?: 3 | 5 | 10;
  statusCallbackUrl?: string;
  fetchImplementation?: typeof fetch;
}): Promise<{ sid: string; status: string }> {
  const accountSid = z.string().regex(/^AC[0-9a-fA-F]{32}$/u).parse(options.accountSid);
  const from = E164Schema.parse(options.from);
  const to = E164Schema.parse(options.to);
  const sipUri = buildCallbackSipUri({
    projectId: options.projectId,
    callerNumber: to,
    relaySecret: options.relaySecret,
    ...(options.learnerId ? { learnerId: options.learnerId } : {}),
    ...(options.durationMinutes
      ? { durationMinutes: options.durationMinutes }
      : {}),
  });
  const escapedSipUri = sipUri.replaceAll("&", "&amp;");
  const twiml = `<Response><Dial answerOnBridge="true"><Sip>${escapedSipUri}</Sip></Dial></Response>`;
  const body = new URLSearchParams({
    To: to,
    From: from,
    Twiml: twiml,
    ...(options.statusCallbackUrl
      ? {
          StatusCallback: z.string().url().parse(options.statusCallbackUrl),
          StatusCallbackMethod: "POST",
          StatusCallbackEvent: "initiated ringing answered completed",
        }
      : {}),
  });
  const response = await (options.fetchImplementation ?? fetch)(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${options.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Twilio callback creation failed with status ${response.status}.`);
  }
  return TwilioCallResponseSchema.parse(await response.json());
}
