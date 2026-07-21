import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  AccessModeSchema,
  type AccessMode,
} from "../domain/product-metrics.js";

const SipHeaderSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

export const RealtimeIncomingCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("realtime.call.incoming"),
  data: z
    .object({
      call_id: z.string().min(1),
      sip_headers: z.array(SipHeaderSchema),
    })
    .passthrough(),
});

const RealtimeToolSchema = z.object({
  type: z.literal("function"),
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});

export const RealtimeTurnDetectionSchema = z.object({
  type: z.literal("server_vad"),
  threshold: z.number().min(0).max(1),
  prefix_padding_ms: z.number().int().min(0).max(1_000),
  silence_duration_ms: z.number().int().min(200).max(2_000),
  create_response: z.literal(false),
  interrupt_response: z.literal(true),
});

export type RealtimeTurnDetection = z.infer<
  typeof RealtimeTurnDetectionSchema
>;

export const RealtimeAcceptPayloadSchema = z.object({
  type: z.literal("realtime"),
  model: z.string().min(1),
  instructions: z.string().min(1),
  audio: z.object({
    input: z.object({
      transcription: z.object({ model: z.string().min(1) }),
      turn_detection: RealtimeTurnDetectionSchema,
    }),
    output: z.object({
      voice: z.string().min(1),
      speed: z.number().min(0.25).max(1.5),
    }),
  }),
  tools: z.array(RealtimeToolSchema).min(1),
  tool_choice: z.literal("auto"),
});

export type RealtimeAcceptPayload = z.infer<
  typeof RealtimeAcceptPayloadSchema
>;

export function buildSipTarget(projectId: string): string {
  if (!projectId.trim()) throw new Error("An OpenAI project ID is required.");
  return `sip:${projectId}@sip.api.openai.com;transport=tls`;
}

function verifiedRelayContext(
  event: z.infer<typeof RealtimeIncomingCallSchema>,
  relaySecret: string,
): {
  callerNumber: string;
  learnerId?: string;
  durationMinutes?: 3 | 5 | 10;
  accessMode: AccessMode;
} | undefined {
  const header = (name: string) =>
    event.data.sip_headers.find(
      (candidate) => candidate.name.toLocaleLowerCase() === name,
    )?.value;
  const callerNumber = header("x-continuum-caller");
  const learnerId = header("x-continuum-learner-id");
  const durationValue = header("x-continuum-duration-minutes");
  const accessModeValue = header("x-continuum-access-mode") ?? "unknown";
  const signature = header("x-continuum-signature");
  const accessMode = AccessModeSchema.safeParse(accessModeValue);
  if (
    !callerNumber ||
    !signature ||
    !/^\+[1-9]\d{7,14}$/u.test(callerNumber) ||
    (learnerId !== undefined && !/^[A-Za-z0-9_-]{1,120}$/u.test(learnerId)) ||
    (durationValue !== undefined && !["3", "5", "10"].includes(durationValue)) ||
    !accessMode.success
  ) {
    return undefined;
  }
  const durationMinutes =
    durationValue === undefined
      ? undefined
      : (Number(durationValue) as 3 | 5 | 10);
  const expected = Buffer.from(
    createHmac("sha256", relaySecret)
      .update(
        `continuum-relayed-caller:${callerNumber}:${learnerId ?? "missed-call"}:${durationMinutes ?? "unspecified"}:${accessMode.data}`,
      )
      .digest("hex"),
    "utf8",
  );
  const supplied = Buffer.from(signature, "utf8");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return undefined;
  }
  return {
    callerNumber,
    accessMode: accessMode.data,
    ...(learnerId ? { learnerId } : {}),
    ...(durationMinutes ? { durationMinutes } : {}),
  };
}

export function callerNumberFromIncomingCall(
  unparsedEvent: unknown,
  relaySecret?: string,
): string {
  const event = RealtimeIncomingCallSchema.parse(unparsedEvent);
  if (relaySecret) {
    const relayContext = verifiedRelayContext(event, relaySecret);
    if (relayContext) return relayContext.callerNumber;
  }
  const from = event.data.sip_headers.find(
    (header) => header.name.toLocaleLowerCase() === "from",
  );
  if (!from) throw new Error("Incoming SIP call has no From header.");
  const match = /sips?:([^@;>]+)/iu.exec(from.value);
  const callerNumber = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  if (!callerNumber) {
    throw new Error("Incoming SIP From header has no caller identifier.");
  }
  return callerNumber;
}

export function learnerIdFromIncomingCall(
  unparsedEvent: unknown,
  relaySecret: string,
): string | undefined {
  const event = RealtimeIncomingCallSchema.parse(unparsedEvent);
  return verifiedRelayContext(event, relaySecret)?.learnerId;
}

export function durationFromIncomingCall(
  unparsedEvent: unknown,
  relaySecret: string,
): 3 | 5 | 10 | undefined {
  const event = RealtimeIncomingCallSchema.parse(unparsedEvent);
  return verifiedRelayContext(event, relaySecret)?.durationMinutes;
}

export function accessModeFromIncomingCall(
  unparsedEvent: unknown,
  relaySecret: string,
): AccessMode {
  const event = RealtimeIncomingCallSchema.parse(unparsedEvent);
  return verifiedRelayContext(event, relaySecret)?.accessMode ?? "unknown";
}

export async function acceptRealtimeCall(options: {
  apiKey: string;
  callId: string;
  payload: RealtimeAcceptPayload;
  fetchImplementation?: typeof fetch;
}): Promise<void> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(
    `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(options.callId)}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options.payload),
    },
  );
  if (!response.ok) {
    throw new Error(`Realtime call acceptance failed with ${response.status}.`);
  }
}

export async function rejectRealtimeCall(options: {
  apiKey: string;
  callId: string;
  statusCode?: number;
  fetchImplementation?: typeof fetch;
}): Promise<void> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(
    `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(options.callId)}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status_code: options.statusCode ?? 486 }),
    },
  );
  if (!response.ok) {
    throw new Error(`Realtime call rejection failed with ${response.status}.`);
  }
}
