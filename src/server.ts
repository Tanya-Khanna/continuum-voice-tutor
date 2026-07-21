import { createServer, type IncomingHttpHeaders } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import OpenAI from "openai";
import { loadEnvironment, requireOpenAIKey } from "./config/env.js";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "./config/voice-language-menu.js";
import { DASHBOARD_HTML } from "./dashboard/page.js";
import { runOpenTopicOfflineEvaluation } from "./evals/open-topic-offline-evaluator.js";
import { readOpenTopicLiveEvalReport } from "./evals/open-topic-live-report.js";
import { hashPhoneNumber } from "./domain/identity.js";
import {
  resolveTwilioSmsConfig,
  sendTwilioSms,
} from "./messaging/twilio-sms.js";
import { buildDashboardSnapshot } from "./observability/dashboard.js";
import { SqliteLearningRepository } from "./persistence/sqlite-learning-repository.js";
import { createOpenTopicRuntime } from "./runtime/open-topic-runtime.js";
import { CallAdmissionGuard } from "./telephony/call-admission.js";
import { buildPhoneReadinessReport } from "./telephony/readiness.js";
import {
  RealtimeIncomingCallSchema,
  acceptRealtimeCall,
  accessModeFromIncomingCall,
  callerNumberFromIncomingCall,
  rejectRealtimeCall,
} from "./telephony/sip.js";
import { buildOpenTopicRealtimeAcceptPayload } from "./telephony/open-topic-realtime.js";
import { OpenTopicRealtimeBridge } from "./telephony/open-topic-realtime-bridge.js";
import {
  MISSED_CALL_REJECT_TWIML,
  MissedCallCallbackService,
  placeTwilioCallback,
} from "./telephony/missed-call-callback.js";
import { validateTwilioSignature } from "./telephony/twilio-signature.js";
import { GuardianAccessService } from "./guardian/guardian-access-service.js";
import { OpenTopicSmsService } from "./messaging/open-topic-sms-service.js";
import { HomeworkService } from "./messaging/homework-service.js";
import { SmsReminderService } from "./messaging/sms-reminder-service.js";
import { buildLessonRecapSms } from "./messaging/lesson-recap.js";
import {
  ProductMetricEventSchema,
  type AccessMode,
} from "./domain/product-metrics.js";
import {
  TwilioCallStatusWebhookSchema,
  TwilioMessageStatusWebhookSchema,
} from "./domain/carrier-usage.js";
import {
  applyCarrierStatusWebhook,
  applyTwilioCallResource,
  carrierCallStatusCallbackUrl,
  createCarrierCallReceipt,
  fetchTwilioCallResource,
  markCarrierCallQueued,
} from "./telephony/carrier-usage.js";
import { buildProductMetrics } from "./observability/product-metrics.js";
import { renderLandingPage } from "./landing/page.js";
import { SAMPLE_SESSION } from "./samples/sample-session.js";
import {
  assertPublicDashboardProtected,
  dashboardRequestAuthorized,
} from "./security/dashboard-access.js";
import {
  RequestBodyTooLargeError,
  readRequestBody,
} from "./security/http-body.js";

function headersFromIncoming(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

const environment = loadEnvironment();
assertPublicDashboardProtected({
  publicWebhook:
    environment.NOMAD_OPENAI_WEBHOOK_PUBLIC ||
    environment.NOMAD_MISSED_CALL_ENABLED ||
    environment.NOMAD_SMS_CONTROLS_ENABLED ||
    environment.NOMAD_SMS_REMINDERS_ENABLED,
  ...(environment.NOMAD_DASHBOARD_TOKEN
    ? { dashboardToken: environment.NOMAD_DASHBOARD_TOKEN }
    : {}),
});
const twilioSmsConfig = resolveTwilioSmsConfig(environment);
const activeCallIds = new Set<string>();
const callAdmission = new CallAdmissionGuard({
  maxCallsPerWindow: environment.NOMAD_MAX_CALLS_PER_HOUR,
});

function createMissedCallService(
  repository: SqliteLearningRepository,
): MissedCallCallbackService {
  return new MissedCallCallbackService({
    repository,
    secret: environment.NOMAD_CALLBACK_SECRET,
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    allowedPrefixes: environment.NOMAD_CALLBACK_ALLOWED_PREFIXES,
    timeZone: environment.NOMAD_DEPLOYMENT_TIME_ZONE,
    quietStartHour: environment.NOMAD_CALLBACK_QUIET_START_HOUR,
    quietEndHour: environment.NOMAD_CALLBACK_QUIET_END_HOUR,
    perNumberDailyLimit: environment.NOMAD_CALLBACK_PER_NUMBER_DAILY_LIMIT,
    globalDailyLimit: environment.NOMAD_CALLBACK_GLOBAL_DAILY_LIMIT,
    allowAdultDemo: environment.NOMAD_MISSED_CALL_ADULT_DEMO,
  });
}

function appendMetric(
  repository: SqliteLearningRepository,
  options: {
    id: string;
    name: Parameters<SqliteLearningRepository["appendProductMetric"]>[0]["name"];
    learnerId?: string | null;
    sessionId?: string | null;
    channel: "phone" | "dtmf" | "sms" | "system";
    accessMode: "missed_call" | "sponsored" | "direct_dial" | "scheduled" | "unknown";
    numericValue?: number | null;
    synthetic?: boolean;
    createdAt?: string;
  },
): void {
  repository.appendProductMetric(
    ProductMetricEventSchema.parse({
      id: options.id,
      name: options.name,
      learnerId: options.learnerId ?? null,
      sessionId: options.sessionId ?? null,
      channel: options.channel,
      accessMode: options.accessMode,
      numericValue: options.numericValue ?? null,
      synthetic: options.synthetic ?? false,
      createdAt: options.createdAt ?? new Date().toISOString(),
    }),
  );
}

function messageStatusCallbackUrl(): string | undefined {
  if (!environment.NOMAD_PUBLIC_BASE_URL) return undefined;
  return new URL(
    "/webhooks/twilio/message-status",
    environment.NOMAD_PUBLIC_BASE_URL,
  ).toString();
}

async function sendTrackedSms(options: {
  repository: SqliteLearningRepository;
  to: string;
  body: string;
  learnerId?: string;
  accessMode?: AccessMode;
}): Promise<{ sid: string } | undefined> {
  if (!twilioSmsConfig) return;
  const statusCallbackUrl = messageStatusCallbackUrl();
  const sent = await sendTwilioSms({
    ...twilioSmsConfig,
    to: options.to,
    body: options.body,
    ...(statusCallbackUrl ? { statusCallbackUrl } : {}),
  });
  appendMetric(options.repository, {
    id: `sms-segments:${sent.sid}`,
    name: "sms_segments_sent",
    learnerId: options.learnerId ?? null,
    channel: "sms",
    accessMode: options.accessMode ?? "unknown",
    numericValue: sent.segments,
  });
  return { sid: sent.sid };
}

function createSmsReminderService(
  repository: SqliteLearningRepository,
): SmsReminderService {
  return new SmsReminderService({
    repository,
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    encryptionSecret: environment.NOMAD_CALLBACK_SECRET,
    timeZone: environment.NOMAD_DEPLOYMENT_TIME_ZONE,
    quietStartHour: environment.NOMAD_CALLBACK_QUIET_START_HOUR,
    quietEndHour: environment.NOMAD_CALLBACK_QUIET_END_HOUR,
  });
}

async function processDueSmsReminders(): Promise<void> {
  const repository = new SqliteLearningRepository(environment.NOMAD_DATABASE_PATH);
  try {
    const result = await createSmsReminderService(repository).runDue(
      async ({ to, body }) =>
        sendTrackedSms({
          repository,
          to,
          body,
        }),
    );
    if (result.sent || result.cancelled || result.deferred || result.failed) {
      console.log("SMS reminder sweep:", result);
    }
  } finally {
    repository.close();
  }
}

async function reconcileCarrierReceipt(receiptId: string): Promise<void> {
  const repository = new SqliteLearningRepository(environment.NOMAD_DATABASE_PATH);
  try {
    const receipt = repository.findCarrierCallReceipt(receiptId);
    if (!receipt?.providerCallSid || receipt.priceFetchAttempts >= 10) return;
    const resource = await fetchTwilioCallResource({
      accountSid: environment.TWILIO_ACCOUNT_SID!,
      authToken: environment.TWILIO_AUTH_TOKEN!,
      callSid: receipt.providerCallSid,
    });
    const updated = applyTwilioCallResource({
      receipt,
      resource,
      now: new Date().toISOString(),
    });
    repository.saveCarrierCallReceipt(updated);
    const accessMode = updated.kind === "scheduled" ? "scheduled" : "missed_call";
    if (updated.durationSeconds !== null) {
      appendMetric(repository, {
        id: `carrier-duration:${updated.id}`,
        name: "carrier_call_duration_seconds",
        learnerId: updated.learnerId,
        channel: "phone",
        accessMode,
        numericValue: updated.durationSeconds,
        synthetic: updated.synthetic,
      });
    }
    if (updated.priceAmount !== null && updated.priceCurrency === "USD") {
      appendMetric(repository, {
        id: `carrier-cost:${updated.id}`,
        name: "carrier_call_cost_usd",
        learnerId: updated.learnerId,
        channel: "system",
        accessMode,
        numericValue: updated.priceAmount,
        synthetic: updated.synthetic,
      });
    }
  } finally {
    repository.close();
  }
}

async function reconcileUnpricedCarrierReceipts(): Promise<void> {
  const repository = new SqliteLearningRepository(environment.NOMAD_DATABASE_PATH);
  let ids: string[] = [];
  try {
    ids = repository
      .listUnpricedCarrierCallReceipts(20)
      .filter((receipt) => receipt.providerCallSid && receipt.priceFetchAttempts < 10)
      .map((receipt) => receipt.id);
  } finally {
    repository.close();
  }
  for (const id of ids) {
    try {
      await reconcileCarrierReceipt(id);
    } catch (error) {
      console.error(
        `Carrier receipt ${id} reconciliation failed:`,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
}

function scheduleCarrierReceiptReconciliation(receiptId: string): void {
  for (const delayMs of [0, 5_000, 30_000]) {
    const timer = setTimeout(() => {
      void reconcileCarrierReceipt(receiptId).catch((error: unknown) =>
        console.error(
          `Carrier receipt ${receiptId} reconciliation failed:`,
          error instanceof Error ? error.message : "unknown error",
        ),
      );
    }, delayMs);
    timer.unref();
  }
}

async function processCallbackJob(jobId: string): Promise<void> {
  const repository = new SqliteLearningRepository(environment.NOMAD_DATABASE_PATH);
  try {
    const now = new Date();
    const claimed = repository.claimCallbackJob({
      id: jobId,
      claimToken: randomUUID(),
      claimExpiresAt: new Date(now.getTime() + 2 * 60_000).toISOString(),
      now: now.toISOString(),
    });
    if (!claimed) return;
    const service = createMissedCallService(repository);
    const receiptId = randomUUID();
    const receipt = createCarrierCallReceipt({
      id: receiptId,
      kind: "missed_call",
      callbackJobId: claimed.id,
      now: new Date().toISOString(),
    });
    repository.saveCarrierCallReceipt(receipt);
    try {
      const placed = await placeTwilioCallback({
        accountSid: environment.TWILIO_ACCOUNT_SID!,
        authToken: environment.TWILIO_AUTH_TOKEN!,
        from: (environment.TWILIO_MISSED_CALL_NUMBER ??
          environment.TWILIO_PHONE_NUMBER)!,
        to: service.destination(claimed),
        projectId: environment.OPENAI_PROJECT_ID!,
        relaySecret: environment.NOMAD_CALLBACK_SECRET,
        accessMode: "missed_call",
        statusCallbackUrl: carrierCallStatusCallbackUrl(
          environment.NOMAD_PUBLIC_BASE_URL!,
          receiptId,
        ),
      });
      repository.saveCarrierCallReceipt(
        markCarrierCallQueued(
          repository.findCarrierCallReceipt(receiptId) ?? receipt,
          placed.sid,
          new Date().toISOString(),
        ),
      );
      repository.saveCallbackJob({
        ...claimed,
        status: "completed",
        providerCallSid: placed.sid,
        claimToken: null,
        claimExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
      repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: randomUUID(),
          name: "callback_placed",
          learnerId: null,
          sessionId: null,
          channel: "system",
          accessMode: "missed_call",
          numericValue: null,
          synthetic: false,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      repository.saveCarrierCallReceipt({
        ...receipt,
        status: "failed",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      repository.saveCallbackJob({
        ...claimed,
        status: "failed",
        errorCode:
          error instanceof Error && /status \d+/u.test(error.message)
            ? error.message
            : "callback_failed",
        claimToken: null,
        claimExpiresAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
  } finally {
    repository.close();
  }
}

export const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          teachingEngine: environment.TEACHING_ENGINE,
          realtimeConfigured: Boolean(
            environment.OPENAI_API_KEY && environment.OPENAI_WEBHOOK_SECRET,
          ),
          experience: "open_topic_teacher",
          curriculumRequiredForCalls: false,
          releaseRevision: (
            environment.NOMAD_RELEASE_COMMIT ??
            environment.RAILWAY_GIT_COMMIT_SHA ??
            "local"
          ).slice(0, 12),
          accessFeatures: {
            missedCallCallback: environment.NOMAD_MISSED_CALL_ENABLED,
            smsControls: environment.NOMAD_SMS_CONTROLS_ENABLED,
            scheduler: false,
            smsReminders: environment.NOMAD_SMS_REMINDERS_ENABLED,
            smsRecap: environment.NOMAD_SMS_RECAP_ENABLED,
          },
          publicPhonePublished: environment.NOMAD_PUBLIC_PHONE_ENABLED,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      });
      response.end(
        renderLandingPage({
          ...(environment.NOMAD_PUBLIC_PHONE_ENABLED &&
          environment.TWILIO_PHONE_NUMBER
            ? { phoneNumber: environment.TWILIO_PHONE_NUMBER }
            : {}),
          phoneReady:
            environment.NOMAD_PUBLIC_PHONE_ENABLED &&
            environment.NOMAD_TWILIO_NUMBER_VOICE_READY &&
            environment.NOMAD_OPENAI_WEBHOOK_PUBLIC,
          missedCallEnabled: environment.NOMAD_MISSED_CALL_ENABLED,
        }),
      );
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/twilio/missed-call"
    ) {
      if (!environment.NOMAD_MISSED_CALL_ENABLED) {
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "missed_call_disabled" }));
        return;
      }
      const rawBody = await readRequestBody(request);
      const parameters = new URLSearchParams(rawBody);
      const signatureUrl = new URL(
        request.url ?? url.pathname,
        environment.NOMAD_PUBLIC_BASE_URL!,
      ).toString();
      const signatureHeader = request.headers["x-twilio-signature"];
      const providedSignature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;
      if (
        !validateTwilioSignature({
          authToken: environment.TWILIO_AUTH_TOKEN!,
          url: signatureUrl,
          parameters,
          ...(providedSignature ? { providedSignature } : {}),
        })
      ) {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_twilio_signature" }));
        return;
      }
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      let callbackJobId: string | undefined;
      try {
        const result = createMissedCallService(repository).enqueue(
          Object.fromEntries(parameters.entries()),
        );
        if (result.status === "queued") callbackJobId = result.job.id;
      } finally {
        repository.close();
      }
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(MISSED_CALL_REJECT_TWIML);
      if (callbackJobId) {
        setImmediate(() => {
          void processCallbackJob(callbackJobId!).catch((error: unknown) =>
            console.error(
              "Missed-call callback worker failed:",
              error instanceof Error ? error.message : "unknown error",
            ),
          );
        });
      }
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/twilio/call-status"
    ) {
      const rawBody = await readRequestBody(request);
      const parameters = new URLSearchParams(rawBody);
      const signatureUrl = new URL(
        request.url ?? url.pathname,
        environment.NOMAD_PUBLIC_BASE_URL!,
      ).toString();
      const signatureHeader = request.headers["x-twilio-signature"];
      const providedSignature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;
      if (
        !validateTwilioSignature({
          authToken: environment.TWILIO_AUTH_TOKEN!,
          url: signatureUrl,
          parameters,
          ...(providedSignature ? { providedSignature } : {}),
        })
      ) {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_twilio_signature" }));
        return;
      }
      const receiptId = url.searchParams.get("receipt_id") ?? "";
      const payload = TwilioCallStatusWebhookSchema.parse(
        Object.fromEntries(parameters.entries()),
      );
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      let shouldReconcile = false;
      try {
        const receipt = repository.findCarrierCallReceipt(receiptId);
        if (receipt) {
          const result = applyCarrierStatusWebhook({
            receipt,
            payload,
            now: new Date().toISOString(),
          });
          if (result.advanced) {
            repository.saveCarrierCallReceipt(result.receipt);
            const accessMode = result.receipt.kind === "scheduled"
              ? "scheduled"
              : "missed_call";
            if (result.receipt.status === "answered") {
              appendMetric(repository, {
                id: `carrier-answered:${result.receipt.id}`,
                name: "carrier_call_answered",
                learnerId: result.receipt.learnerId,
                channel: "phone",
                accessMode,
                synthetic: result.receipt.synthetic,
              });
            }
            if (result.becameTerminal) {
              appendMetric(repository, {
                id: `carrier-terminal:${result.receipt.id}`,
                name:
                  result.receipt.status === "completed"
                    ? "carrier_call_completed"
                    : result.receipt.status === "no_answer"
                      ? "carrier_call_no_answer"
                      : "carrier_call_failed",
                learnerId: result.receipt.learnerId,
                channel: "phone",
                accessMode,
                synthetic: result.receipt.synthetic,
              });
              if (result.receipt.durationSeconds !== null) {
                appendMetric(repository, {
                  id: `carrier-duration:${result.receipt.id}`,
                  name: "carrier_call_duration_seconds",
                  learnerId: result.receipt.learnerId,
                  channel: "phone",
                  accessMode,
                  numericValue: result.receipt.durationSeconds,
                  synthetic: result.receipt.synthetic,
                });
              }
              shouldReconcile = true;
            }
          }
        }
      } finally {
        repository.close();
      }
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      if (shouldReconcile) {
        scheduleCarrierReceiptReconciliation(receiptId);
      }
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/twilio/message-status"
    ) {
      const rawBody = await readRequestBody(request);
      const parameters = new URLSearchParams(rawBody);
      const signatureUrl = new URL(
        request.url ?? url.pathname,
        environment.NOMAD_PUBLIC_BASE_URL!,
      ).toString();
      const signatureHeader = request.headers["x-twilio-signature"];
      const providedSignature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;
      if (
        !validateTwilioSignature({
          authToken: environment.TWILIO_AUTH_TOKEN!,
          url: signatureUrl,
          parameters,
          ...(providedSignature ? { providedSignature } : {}),
        })
      ) {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_twilio_signature" }));
        return;
      }
      const payload = TwilioMessageStatusWebhookSchema.parse(
        Object.fromEntries(parameters.entries()),
      );
      if (
        payload.MessageStatus === "delivered" ||
        payload.MessageStatus === "undelivered" ||
        payload.MessageStatus === "failed"
      ) {
        const repository = new SqliteLearningRepository(
          environment.NOMAD_DATABASE_PATH,
        );
        try {
          appendMetric(repository, {
            id: `sms-status:${payload.MessageSid}`,
            name:
              payload.MessageStatus === "delivered"
                ? "sms_delivered"
                : "sms_failed",
            channel: "sms",
            accessMode: "unknown",
          });
        } finally {
          repository.close();
        }
      }
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/twilio/sms"
    ) {
      if (!environment.NOMAD_SMS_CONTROLS_ENABLED) {
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "sms_controls_disabled" }));
        return;
      }
      const rawBody = await readRequestBody(request);
      const parameters = new URLSearchParams(rawBody);
      const signatureUrl = new URL(
        request.url ?? url.pathname,
        environment.NOMAD_PUBLIC_BASE_URL!,
      ).toString();
      const signatureHeader = request.headers["x-twilio-signature"];
      const providedSignature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;
      if (
        !validateTwilioSignature({
          authToken: environment.TWILIO_AUTH_TOKEN!,
          url: signatureUrl,
          parameters,
          ...(providedSignature ? { providedSignature } : {}),
        })
      ) {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_twilio_signature" }));
        return;
      }
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      try {
        const messageSid = parameters.get("MessageSid") ?? "";
        const existing = repository.findSmsReceipt(messageSid);
        if (!existing) {
          const guardianAccess = new GuardianAccessService({
            repository,
            secret: environment.NOMAD_GUARDIAN_CODE_SECRET,
            phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
          });
          const receipt = new OpenTopicSmsService({
            repository,
            guardianAccess,
            homeworkService: new HomeworkService({
              repository,
              phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
            }),
            reminderService: createSmsReminderService(repository),
          }).handle(Object.fromEntries(parameters.entries()));
          await sendTrackedSms({
            repository,
            to: parameters.get("From") ?? "",
            body: receipt.responseText,
            ...(receipt.learnerId ? { learnerId: receipt.learnerId } : {}),
          });
        }
      } finally {
        repository.close();
      }
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end('<?xml version="1.0" encoding="UTF-8"?><Response/>');
      return;
    }

    if (request.method === "GET" && url.pathname === "/dashboard") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      });
      response.end(DASHBOARD_HTML);
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/assets/sample-universal-code-switch.mp3"
    ) {
      const audio = await readFile(
        resolve("public/samples/sample-universal-code-switch.mp3"),
      );
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
        const start = Number(match?.[1]);
        const requestedEnd = match?.[2] ? Number(match[2]) : audio.length - 1;
        const end = Math.min(requestedEnd, audio.length - 1);
        if (!match || !Number.isSafeInteger(start) || start < 0 || start > end) {
          response.writeHead(416, {
            "Content-Range": `bytes */${audio.length}`,
          });
          response.end();
          return;
        }
        const chunk = audio.subarray(start, end + 1);
        response.writeHead(206, {
          "Content-Type": "audio/mpeg",
          "Content-Length": chunk.length,
          "Content-Range": `bytes ${start}-${end}/${audio.length}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400",
        });
        response.end(chunk);
        return;
      }
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": audio.length,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      });
      response.end(audio);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard/sample") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(SAMPLE_SESSION));
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/dashboard/readiness"
    ) {
      if (
        !dashboardRequestAuthorized({
          ...(environment.NOMAD_DASHBOARD_TOKEN
            ? { expectedToken: environment.NOMAD_DASHBOARD_TOKEN }
            : {}),
          ...(request.headers.authorization
            ? { authorizationHeader: request.headers.authorization }
            : {}),
        })
      ) {
        response.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "WWW-Authenticate": 'Bearer realm="Continuum Mission Control"',
          "X-Content-Type-Options": "nosniff",
        });
        response.end(JSON.stringify({ error: "dashboard_access_required" }));
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(JSON.stringify(buildPhoneReadinessReport(environment)));
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/dashboard/sessions"
    ) {
      if (
        !dashboardRequestAuthorized({
          ...(environment.NOMAD_DASHBOARD_TOKEN
            ? { expectedToken: environment.NOMAD_DASHBOARD_TOKEN }
            : {}),
          ...(request.headers.authorization
            ? { authorizationHeader: request.headers.authorization }
            : {}),
        })
      ) {
        response.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "WWW-Authenticate": 'Bearer realm="Continuum Mission Control"',
          "X-Content-Type-Options": "nosniff",
        });
        response.end(JSON.stringify({ error: "dashboard_access_required" }));
        return;
      }
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      try {
        const snapshot = buildDashboardSnapshot({
          repository,
          limit: Number(url.searchParams.get("limit") ?? 20),
        });
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(JSON.stringify(snapshot));
      } finally {
        repository.close();
      }
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/dashboard/product-metrics"
    ) {
      if (
        !dashboardRequestAuthorized({
          ...(environment.NOMAD_DASHBOARD_TOKEN
            ? { expectedToken: environment.NOMAD_DASHBOARD_TOKEN }
            : {}),
          ...(request.headers.authorization
            ? { authorizationHeader: request.headers.authorization }
            : {}),
        })
      ) {
        response.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "WWW-Authenticate": 'Bearer realm="Continuum Mission Control"',
        });
        response.end(JSON.stringify({ error: "dashboard_access_required" }));
        return;
      }
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      try {
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(buildProductMetrics(repository)));
      } finally {
        repository.close();
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard/evals") {
      if (
        !dashboardRequestAuthorized({
          ...(environment.NOMAD_DASHBOARD_TOKEN
            ? { expectedToken: environment.NOMAD_DASHBOARD_TOKEN }
            : {}),
          ...(request.headers.authorization
            ? { authorizationHeader: request.headers.authorization }
            : {}),
        })
      ) {
        response.writeHead(401, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "WWW-Authenticate": 'Bearer realm="Continuum Mission Control"',
          "X-Content-Type-Options": "nosniff",
        });
        response.end(JSON.stringify({ error: "dashboard_access_required" }));
        return;
      }
      const [report, liveReport] = await Promise.all([
        runOpenTopicOfflineEvaluation(),
        readOpenTopicLiveEvalReport(
          environment.NOMAD_OPEN_TOPIC_LIVE_EVAL_REPORT_PATH,
        ),
      ]);
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          generated_at: new Date().toISOString(),
          gate: "deterministic_offline",
          ...report,
          live_report: liveReport,
        }),
      );
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/openai"
    ) {
      const apiKey = requireOpenAIKey(environment);
      if (!environment.OPENAI_WEBHOOK_SECRET) {
        throw new Error("OPENAI_WEBHOOK_SECRET is required for the webhook.");
      }

      const rawBody = await readRequestBody(request);
      const client = new OpenAI({
        apiKey,
        webhookSecret: environment.OPENAI_WEBHOOK_SECRET,
      });
      const event = await client.webhooks.unwrap(
        rawBody,
        headersFromIncoming(request.headers),
      );

      if (event.type === "realtime.call.incoming") {
        const incomingCall = RealtimeIncomingCallSchema.parse(event);
        console.log(
          "Verified signed realtime.call.incoming webhook; evaluating call admission.",
        );
        const callId = incomingCall.data.call_id;
        if (activeCallIds.has(callId)) {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ received: true, duplicate: true }));
          return;
        }
        const callerNumber = callerNumberFromIncomingCall(
          incomingCall,
          environment.NOMAD_CALLBACK_SECRET,
        );
        const callerKey = hashPhoneNumber(
          callerNumber,
          environment.NOMAD_PHONE_HASH_SECRET,
        );
        const admission = callAdmission.begin(incomingCall.id, callerKey);
        if (admission === "duplicate_webhook") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ received: true, duplicate: true }));
          return;
        }
        if (admission !== "allowed") {
          await rejectRealtimeCall({ apiKey, callId, statusCode: 486 });
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({ received: true, rejected: admission }),
          );
          return;
        }
        activeCallIds.add(callId);
        try {
          await acceptRealtimeCall({
            apiKey,
            callId,
            payload: buildOpenTopicRealtimeAcceptPayload(
              environment.OPENAI_REALTIME_MODEL,
              environment.OPENAI_REALTIME_VOICE,
              {
                type: "server_vad",
                threshold: environment.NOMAD_VAD_THRESHOLD,
                prefix_padding_ms:
                  environment.NOMAD_VAD_PREFIX_PADDING_MS,
                silence_duration_ms: environment.NOMAD_VAD_SILENCE_MS,
                create_response: false,
                interrupt_response: true,
              },
              environment.OPENAI_REALTIME_SPEED,
              {
                nowIso: new Date().toISOString(),
                timeZone: environment.NOMAD_DEPLOYMENT_TIME_ZONE,
              },
            ),
          });

          const runtime = createOpenTopicRuntime(environment);
          const callAccessMode = accessModeFromIncomingCall(
            incomingCall,
            environment.NOMAD_CALLBACK_SECRET,
          );
          const bridge = new OpenTopicRealtimeBridge({
            apiKey,
            callId,
            callerNumber,
            lessonService: runtime.lessonService,
            portableIdentity: runtime.portableIdentity,
            languageMenu: DEFAULT_VOICE_LANGUAGE_MENU,
            initialAccessMode: callAccessMode,
            modelRoute: environment.OPENAI_REALTIME_MODEL,
            onError: (bridgeError) =>
              console.error(`Realtime call ${callId}:`, bridgeError.message),
            ...(environment.NOMAD_SMS_REMINDERS_ENABLED
              ? {
                  onSmsReminderConfirmed: async ({
                    callerNumber: recipientPhoneNumber,
                    learner,
                    kind,
                    topic,
                    dueAt,
                    examAt,
                  }) => {
                    const reminders = createSmsReminderService(
                      runtime.repository,
                    );
                    if (kind === "exam_review" && examAt) {
                      reminders.scheduleExamReview({
                        learnerId: learner.id,
                        recipientPhoneNumber,
                        topic,
                        dueAt,
                        examAt,
                        consentConfirmed: true,
                      });
                    } else {
                      reminders.scheduleCallbackNudge({
                        learnerId: learner.id,
                        recipientPhoneNumber,
                        topic,
                        dueAt,
                        consentConfirmed: true,
                      });
                    }
                  },
                }
              : {}),
            ...(twilioSmsConfig
              ? {
                  onLessonCompleted: async ({
                    callerNumber: to,
                    context,
                  }) => {
                    const smsAuthorization = runtime.repository.findGuardianAuthorization(
                      context.learner.id,
                    );
                    if (
                      !smsAuthorization?.smsAllowed ||
                      smsAuthorization.guardianPhoneHash !==
                        hashPhoneNumber(to, environment.NOMAD_PHONE_HASH_SECRET)
                    ) {
                      return;
                    }
                    const draft = runtime.lessonService.homeworkDraft(context);
                    const body = draft
                      ? runtime.homework.assign({
                          learnerId: context.learner.id,
                          sessionId: context.session.id,
                          recipientPhoneNumber: to,
                          draft,
                        }).smsText
                      : buildLessonRecapSms({
                          topic: context.session.concept,
                          understanding: context.session.masteryStatus,
                        });
                    await sendTrackedSms({
                      repository: runtime.repository,
                      to,
                      body,
                      learnerId: context.learner.id,
                      accessMode: context.session.accessMode,
                    });
                  },
                  onLessonPaused: async ({
                    callerNumber: to,
                    context,
                    pendingQuestionNumber,
                  }) => {
                    const smsAuthorization = runtime.repository.findGuardianAuthorization(
                      context.learner.id,
                    );
                    if (
                      !smsAuthorization?.smsAllowed ||
                      smsAuthorization.guardianPhoneHash !==
                        hashPhoneNumber(to, environment.NOMAD_PHONE_HASH_SECRET)
                    ) {
                      return;
                    }
                    await sendTrackedSms({
                      repository: runtime.repository,
                      to,
                      body: `Lesson paused at Q${pendingQuestionNumber}. Call back anytime and enter your learner code.`,
                      learnerId: context.learner.id,
                      accessMode: context.session.accessMode,
                    });
                  },
                }
              : {}),
          });
          void bridge
            .run()
            .catch((bridgeError: unknown) => {
              const message =
                bridgeError instanceof Error
                  ? bridgeError.message
                  : "Unknown bridge failure";
              console.error(
                `Realtime call ${callId} ended with an error:`,
                message,
              );
            })
            .finally(() => {
              runtime.close();
              activeCallIds.delete(callId);
              callAdmission.end(callerKey);
            });
        } catch (error) {
          activeCallIds.delete(callId);
          callAdmission.end(callerKey);
          throw error;
        }
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ received: true }));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    console.error(
      "Request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    response.writeHead(error instanceof RequestBodyTooLargeError ? 413 : 400, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify({ error: "request_failed" }));
  }
});

server.listen(environment.PORT, environment.HOST, () => {
  console.log(
    `Continuum server listening on http://${environment.HOST}:${environment.PORT}`,
  );
});

if (environment.TWILIO_ACCOUNT_SID && environment.TWILIO_AUTH_TOKEN) {
  void reconcileUnpricedCarrierReceipts().catch((error: unknown) =>
    console.error(
      "Carrier receipt startup reconciliation failed:",
      error instanceof Error ? error.name : "UnknownError",
    ),
  );
}

if (environment.NOMAD_SMS_REMINDERS_ENABLED) {
  void processDueSmsReminders().catch((error: unknown) =>
    console.error(
      "SMS reminder sweep failed:",
      error instanceof Error ? error.message : "unknown error",
    ),
  );
  const smsReminderTimer = setInterval(() => {
    void processDueSmsReminders().catch((error: unknown) =>
      console.error(
        "SMS reminder sweep failed:",
        error instanceof Error ? error.message : "unknown error",
      ),
    );
  }, environment.NOMAD_SMS_REMINDER_INTERVAL_MS);
  smsReminderTimer.unref();
}
