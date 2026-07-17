import { createServer, type IncomingHttpHeaders } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import OpenAI from "openai";
import {
  curriculumCatalogOptions,
  loadCurriculumCatalog,
} from "./config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "./config/env.js";
import { DASHBOARD_HTML } from "./dashboard/page.js";
import { runOfflineEvaluation } from "./evals/offline-evaluator.js";
import { readAgentEvalReport } from "./evals/agent/report.js";
import { hashPhoneNumber } from "./domain/identity.js";
import {
  resolveTwilioSmsConfig,
  sendTwilioSms,
} from "./messaging/twilio-sms.js";
import { buildDashboardSnapshot } from "./observability/dashboard.js";
import { SqliteLearningRepository } from "./persistence/sqlite-learning-repository.js";
import { createLessonRuntime } from "./runtime/lesson-runtime.js";
import { CallAdmissionGuard } from "./telephony/call-admission.js";
import {
  RealtimeIncomingCallSchema,
  acceptRealtimeCall,
  buildRealtimeAcceptPayload,
  callerNumberFromIncomingCall,
  rejectRealtimeCall,
} from "./telephony/realtime-sip.js";
import { RealtimeTeachingBridge } from "./telephony/realtime-teaching-bridge.js";
import { SAMPLE_SESSION } from "./samples/sample-session.js";
import {
  assertPublicDashboardProtected,
  dashboardRequestAuthorized,
} from "./security/dashboard-access.js";

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

async function readBody(request: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const environment = loadEnvironment();
assertPublicDashboardProtected({
  publicWebhook: environment.NOMAD_OPENAI_WEBHOOK_PUBLIC,
  ...(environment.NOMAD_DASHBOARD_TOKEN
    ? { dashboardToken: environment.NOMAD_DASHBOARD_TOKEN }
    : {}),
});
const twilioSmsConfig = resolveTwilioSmsConfig(environment);
const activeCallIds = new Set<string>();
const callAdmission = new CallAdmissionGuard({
  maxCallsPerWindow: environment.NOMAD_MAX_CALLS_PER_HOUR,
});
const curriculumCatalog = loadCurriculumCatalog(
  curriculumCatalogOptions(environment),
);

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
          guidedSubjects: curriculumCatalog.subjects(),
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/dashboard") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
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
          "WWW-Authenticate": 'Bearer realm="Nomad Mission Control"',
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
          curriculumPacks: curriculumCatalog
            .list()
            .map((option) => option.pack),
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

    if (request.method === "GET" && url.pathname === "/api/dashboard/evals") {
      const [report, agentReport] = await Promise.all([
        runOfflineEvaluation(),
        readAgentEvalReport(environment.NOMAD_AGENT_EVAL_REPORT_PATH),
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
          agent_report: agentReport,
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

      const rawBody = await readBody(request);
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
        const callerNumber = callerNumberFromIncomingCall(incomingCall);
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
            payload: buildRealtimeAcceptPayload(
              environment.OPENAI_REALTIME_MODEL,
              environment.OPENAI_REALTIME_VOICE,
              {
                type: "server_vad",
                threshold: environment.NOMAD_VAD_THRESHOLD,
                prefix_padding_ms:
                  environment.NOMAD_VAD_PREFIX_PADDING_MS,
                silence_duration_ms: environment.NOMAD_VAD_SILENCE_MS,
                create_response: true,
                interrupt_response: true,
              },
              environment.OPENAI_REALTIME_SPEED,
            ),
          });

          const runtime = createLessonRuntime(environment);
          const bridge = new RealtimeTeachingBridge({
            apiKey,
            callId,
            callerNumber,
            lessonService: runtime.lessonService,
            modelRoute: environment.OPENAI_REALTIME_MODEL,
            onError: (bridgeError) =>
              console.error(`Realtime call ${callId}:`, bridgeError.message),
            ...(twilioSmsConfig
              ? {
                  onLessonCompleted: async ({
                    callerNumber: to,
                    turn,
                  }) => {
                    await sendTwilioSms({
                      ...twilioSmsConfig,
                      to,
                      body: turn.spoken_response,
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
    const message = error instanceof Error ? error.message : "Unknown error";
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }
});

server.listen(environment.PORT, environment.HOST, () => {
  console.log(
    `Nomad server listening on http://${environment.HOST}:${environment.PORT}`,
  );
});
