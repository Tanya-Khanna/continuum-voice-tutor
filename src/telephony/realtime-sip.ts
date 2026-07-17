import { z } from "zod";

export const RealtimeIncomingCallSchema = z.object({
  type: z.literal("realtime.call.incoming"),
  data: z
    .object({
      call_id: z.string().min(1),
    })
    .passthrough(),
});

export const RealtimeAcceptPayloadSchema = z.object({
  type: z.literal("realtime"),
  model: z.string().min(1),
  instructions: z.string().min(1),
});

export type RealtimeAcceptPayload = z.infer<
  typeof RealtimeAcceptPayloadSchema
>;

export function buildSipTarget(projectId: string): string {
  if (!projectId.trim()) throw new Error("An OpenAI project ID is required.");
  return `sip:${projectId}@sip.api.openai.com;transport=tls`;
}

export function buildRealtimeAcceptPayload(
  model = "gpt-realtime-2.1",
): RealtimeAcceptPayload {
  return RealtimeAcceptPayloadSchema.parse({
    type: "realtime",
    model,
    instructions:
      "You are Nomad, a patient multilingual Socratic tutor. Speak briefly, ask one question at a time, and never shame the learner.",
  });
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
    const detail = await response.text();
    throw new Error(
      `Realtime call acceptance failed with ${response.status}: ${detail}`,
    );
  }
}
