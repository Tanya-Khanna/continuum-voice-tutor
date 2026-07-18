import { z } from "zod";

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

export const REALTIME_TEACHING_TOOLS = [
  {
    type: "function" as const,
    name: "start_lesson",
    description:
      "Identify the named learner after they say what name they use and return the available guided subjects plus Curious Sandbox. Call this exactly once before mode selection.",
    parameters: {
      type: "object",
      properties: {
        learner_name: {
          type: "string",
          description: "The name the learner just asked to be called.",
        },
        language_mode: {
          type: "string",
          description:
            "Optional detected BCP-47 language tag, or tags joined with + for code-switching, such as es or sw+en.",
        },
      },
      required: ["learner_name"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "choose_learning_mode",
    description:
      "Choose guided curriculum or Curious Sandbox after start_lesson returns the available menu. Call this before the first guided teaching turn.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["guided", "curious_sandbox"],
          description: "The learning mode explicitly chosen by the learner.",
        },
        subject: {
          type: "string",
          description:
            "The guided subject exactly as returned in guided_subjects. Required when guided mode has more than one available subject; omit for Curious Sandbox.",
        },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "complete_placement",
    description:
      "Submit every curriculum-provided placement answer for a learner whose guided-mode menu says placement_required. Never score placement yourself.",
    parameters: {
      type: "object",
      properties: {
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_id: { type: "string" },
              answer: {
                type: "string",
                description:
                  "The learner's faithful answer, preserving language and reasoning.",
              },
            },
            required: ["question_id", "answer"],
            additionalProperties: false,
          },
        },
      },
      required: ["answers"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "submit_placement_answer",
    description:
      "Submit exactly one faithful answer to the current server-provided placement question. The server returns the next placement question or starts the lesson after the final answer.",
    parameters: {
      type: "object",
      properties: {
        question_id: {
          type: "string",
          description:
            "The exact id of the current placement question returned by the server.",
        },
        answer: {
          type: "string",
          description:
            "The learner's faithful answer, preserving language and reasoning.",
        },
      },
      required: ["question_id", "answer"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "get_teaching_turn",
    description:
      "Get the authoritative next Socratic teaching turn. Call this for every substantive learner response after start_lesson.",
    parameters: {
      type: "object",
      properties: {
        learner_answer: {
          type: "string",
          description:
            "A faithful transcript of the learner's complete answer, preserving their language and code-switching.",
        },
      },
      required: ["learner_answer"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "get_learning_history",
    description:
      "Read back the current named learner's persisted learning history. Call this when they ask what they learned, practiced, or worked on before.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "get_sandbox_turn",
    description:
      "Enter Curious Sandbox for an explicit ask-anything request after start_lesson. This is separate from guided curriculum and never awards mastery.",
    parameters: {
      type: "object",
      properties: {
        learner_question: {
          type: "string",
          description:
            "A faithful transcript of the learner's curiosity question, preserving language and code-switching.",
        },
      },
      required: ["learner_question"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "recover_unclear_audio",
    description:
      "Recover when the learner's audio is missing, clipped, or too unclear to transcribe faithfully. Repeat the correct pending prompt without guessing or advancing state.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
] as const;

const RealtimeToolSchema = z.object({
  type: z.literal("function"),
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});

export const RealtimeToolStageSchema = z.enum([
  "identity",
  "menu",
  "placement",
  "guided",
  "curious_sandbox",
]);

export type RealtimeToolStage = z.infer<typeof RealtimeToolStageSchema>;

const REALTIME_TOOL_NAMES_BY_STAGE = {
  identity: ["start_lesson", "recover_unclear_audio"],
  menu: ["choose_learning_mode", "recover_unclear_audio"],
  placement: ["submit_placement_answer", "recover_unclear_audio"],
  guided: [
    "get_teaching_turn",
    "get_learning_history",
    "get_sandbox_turn",
    "recover_unclear_audio",
  ],
  curious_sandbox: [
    "get_sandbox_turn",
    "choose_learning_mode",
    "recover_unclear_audio",
  ],
} as const satisfies Record<RealtimeToolStage, readonly string[]>;

export const RealtimeSessionToolUpdateSchema = z.object({
  type: z.literal("session.update"),
  session: z.object({
    tools: z.array(RealtimeToolSchema).min(1),
    tool_choice: z.literal("auto"),
  }),
});

export function buildRealtimeSessionToolUpdate(
  stage: RealtimeToolStage,
): z.infer<typeof RealtimeSessionToolUpdateSchema> {
  const names = new Set<string>(REALTIME_TOOL_NAMES_BY_STAGE[stage]);
  return RealtimeSessionToolUpdateSchema.parse({
    type: "session.update",
    session: {
      tools: REALTIME_TEACHING_TOOLS.filter((tool) => names.has(tool.name)),
      tool_choice: "auto",
    },
  });
}

export const RealtimeTurnDetectionSchema = z.object({
  type: z.literal("server_vad"),
  threshold: z.number().min(0).max(1),
  prefix_padding_ms: z.number().int().min(0).max(1_000),
  silence_duration_ms: z.number().int().min(200).max(2_000),
  create_response: z.literal(true),
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

export const REALTIME_CONVERSATION_INSTRUCTIONS = `You are Continuum's realtime conversation layer for a universal, voice-first Socratic tutor.
Your job is listening, natural speech, turn-taking, and tool orchestration. The server-side teaching engine makes every teaching decision.
Speak with a warm, calm, patient teaching presence. Use an unhurried cadence with clear pauses, but never sound theatrical, patronizing, or sleepy. Preserve the exact words of authoritative tool responses even while applying this vocal delivery.
At the start of a call, warmly ask only what name the learner wants to use. After they answer, call start_lesson exactly once. Speak the returned guided-subjects-versus-Sandbox menu, then call choose_learning_mode with the learner's explicit choice of mode and, for guided learning, the exact selected subject.
If guided mode returns placement_required, ask its first question exactly. After every placement answer, call submit_placement_answer with the current question ID and a faithful transcript. Speak the next server-provided question exactly. The server starts the lesson after the final answer. Do not score, skip, rewrite, or answer a placement question yourself. Do not call get_teaching_turn until placement completes.
After guided mode is chosen, call get_learning_history if the learner asks what they learned or practiced before. For every other substantive guided response, call get_teaching_turn and pass a faithful transcript, preserving any language or code-switching.
If the learner explicitly asks to use Curious Sandbox or explicitly chooses the ask-anything mode, call get_sandbox_turn instead. Do not silently move an ordinary guided-lesson answer into Sandbox. Sandbox results do not count as curriculum mastery.
If audio is missing, clipped, or too unclear for a faithful transcript, call recover_unclear_audio. Never send a guess to a teaching, placement, history, or Sandbox tool. Speak the recovery output and wait for the learner to repeat; recovery must not advance lesson state.
Immediately before get_teaching_turn, say one brief neutral acknowledgment in the learner's current language, such as the local equivalent of "Let me think about that." Keep it under six words. It must not judge correctness, reveal an answer, give a hint, or ask a new question. Then call the tool in the same response.
Never invent a lesson, diagnosis, explanation, answer, or next question yourself.
After a successful teaching, Sandbox, or history result, speak its spoken_response exactly. Do not add a preface, paraphrase, translate, or append another question. Onboarding menu localization is permitted only when the server's response.create instruction explicitly says so.
Keep conversation management brief and patient. Never shame the learner.`;

export function buildSipTarget(projectId: string): string {
  if (!projectId.trim()) throw new Error("An OpenAI project ID is required.");
  return `sip:${projectId}@sip.api.openai.com;transport=tls`;
}

export function callerNumberFromIncomingCall(unparsedEvent: unknown): string {
  const event = RealtimeIncomingCallSchema.parse(unparsedEvent);
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

export function buildRealtimeAcceptPayload(
  model = "gpt-realtime-2.1-mini",
  voice = "marin",
  turnDetection: RealtimeTurnDetection = {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 650,
    create_response: true,
    interrupt_response: true,
  },
  speed = 0.8,
): RealtimeAcceptPayload {
  return RealtimeAcceptPayloadSchema.parse({
    type: "realtime",
    model,
    audio: {
      input: { turn_detection: turnDetection },
      output: { voice, speed },
    },
    instructions: REALTIME_CONVERSATION_INSTRUCTIONS,
    tools: REALTIME_TEACHING_TOOLS,
    tool_choice: "auto",
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
    const detail = await response.text();
    throw new Error(
      `Realtime call rejection failed with ${response.status}: ${detail}`,
    );
  }
}
