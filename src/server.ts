import { createServer, type IncomingHttpHeaders } from "node:http";
import OpenAI from "openai";
import { loadCurriculumPack } from "./config/curriculum.js";
import { loadEnvironment, requireOpenAIKey } from "./config/env.js";
import { DASHBOARD_HTML } from "./dashboard/page.js";
import { buildDashboardSnapshot } from "./observability/dashboard.js";
import { SqliteLearningRepository } from "./persistence/sqlite-learning-repository.js";
import { createLessonRuntime } from "./runtime/lesson-runtime.js";
import {
  RealtimeIncomingCallSchema,
  acceptRealtimeCall,
  buildRealtimeAcceptPayload,
  callerNumberFromIncomingCall,
} from "./telephony/realtime-sip.js";
import { RealtimeTeachingBridge } from "./telephony/realtime-teaching-bridge.js";

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
const activeCallIds = new Set<string>();

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
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/dashboard") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(DASHBOARD_HTML);
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/dashboard/sessions"
    ) {
      const repository = new SqliteLearningRepository(
        environment.NOMAD_DATABASE_PATH,
      );
      try {
        const snapshot = buildDashboardSnapshot({
          repository,
          curriculumPack: loadCurriculumPack(
            environment.NOMAD_CURRICULUM_PATH,
          ),
          limit: Number(url.searchParams.get("limit") ?? 20),
        });
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(snapshot));
      } finally {
        repository.close();
      }
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
        const callId = incomingCall.data.call_id;
        if (!activeCallIds.has(callId)) {
          activeCallIds.add(callId);
          try {
            const callerNumber = callerNumberFromIncomingCall(incomingCall);
            await acceptRealtimeCall({
              apiKey,
              callId,
              payload: buildRealtimeAcceptPayload(
                environment.OPENAI_REALTIME_MODEL,
                environment.OPENAI_REALTIME_VOICE,
              ),
            });

            const runtime = createLessonRuntime(environment);
            const bridge = new RealtimeTeachingBridge({
              apiKey,
              callId,
              callerNumber,
              lessonService: runtime.lessonService,
              onError: (bridgeError) =>
                console.error(`Realtime call ${callId}:`, bridgeError.message),
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
              });
          } catch (error) {
            activeCallIds.delete(callId);
            throw error;
          }
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

server.listen(environment.PORT, () => {
  console.log(`Nomad server listening on http://localhost:${environment.PORT}`);
});
