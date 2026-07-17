import { createServer, type IncomingHttpHeaders } from "node:http";
import OpenAI from "openai";
import { loadEnvironment, requireOpenAIKey } from "./config/env.js";
import {
  RealtimeIncomingCallSchema,
  acceptRealtimeCall,
  buildRealtimeAcceptPayload,
} from "./telephony/realtime-sip.js";

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

export const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
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

    if (request.method === "POST" && request.url === "/webhooks/openai") {
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
        await acceptRealtimeCall({
          apiKey,
          callId: incomingCall.data.call_id,
          payload: buildRealtimeAcceptPayload(environment.OPENAI_REALTIME_MODEL),
        });
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
