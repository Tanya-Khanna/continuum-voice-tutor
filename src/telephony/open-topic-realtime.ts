import { z } from "zod";
import {
  RealtimeAcceptPayloadSchema,
  type RealtimeAcceptPayload,
  type RealtimeTurnDetection,
} from "./sip.js";

export const OPEN_TOPIC_REALTIME_TOOLS = [
  {
    type: "function" as const,
    name: "select_language",
    description:
      "Select only the language the learner explicitly said or selected after pressing star. Never infer it from silence, a name, caller location, or accent.",
    parameters: {
      type: "object",
      properties: {
        language_mode: {
          type: "string",
          description: "The explicit BCP-47-style language tag.",
        },
      },
      required: ["language_mode"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "start_lesson",
    description:
      "Create a new learner or complete spoken identity in two turns. Copy the server-verified transcript exactly into source_text on every call. First extract the explicit learner name; transliteration across scripts is allowed. After the server asks about a code, send the same name and include learner_code only after explicitly hearing all six digits. Omit learner_code after an explicit no. A code entered by keypad is handled directly by the server.",
    parameters: {
      type: "object",
      properties: {
        learner_name: { type: "string" },
        source_text: {
          type: "string",
          description:
            "Exact server-verified transcript for this identity turn; never paraphrase or translate it.",
        },
        learner_code: {
          type: "string",
          pattern: "^[0-9]{6}$",
          description:
            "Exactly six explicitly spoken digits. Omit for a name-only turn or an explicit no; never send a blank value, a name, or the word no.",
        },
      },
      required: ["learner_name", "source_text"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "teach_open_topic",
    description:
      "Send every substantive learner request, answer, question, or reflection to the trusted open-topic teaching engine. The server transcript is authoritative. Never invent teaching yourself.",
    parameters: {
      type: "object",
      properties: {
        learner_input: {
          type: "string",
          description:
            "A faithful transcript preserving the learner's language and code-switching.",
        },
      },
      required: ["learner_input"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "record_teaching_feedback",
    description:
      "Use only while the server is explicitly asking whether an explanation helped. Feedback is not an academic answer.",
    parameters: {
      type: "object",
      properties: {
        helpfulness: {
          type: "string",
          enum: ["helpful", "not_helpful", "unsure"],
        },
        pace: {
          type: ["string", "null"],
          enum: ["too_fast", "right", "too_slow", null],
        },
        preferred_activity: {
          type: ["string", "null"],
          enum: [
            "explanation",
            "socratic_prompt",
            "analogy",
            "story",
            "worked_example",
            "hint",
            "quiz",
            "teach_back",
            "retrieval",
            "transfer",
            "reflection",
            null,
          ],
        },
      },
      required: ["helpfulness"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "save_learning_preferences",
    description:
      "Save only a learner-stated example preference, learning goal, activity preference, or pace after explicit permission. Never infer a field and never treat it as learning evidence.",
    parameters: {
      type: "object",
      properties: {
        consent_confirmed: { type: "boolean", const: true },
        preferred_examples: {
          type: "array",
          items: { type: "string" },
          maxItems: 12,
        },
        learning_goals: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
        preferred_activities: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "explanation",
              "socratic_prompt",
              "analogy",
              "story",
              "worked_example",
              "hint",
              "quiz",
              "teach_back",
              "retrieval",
              "transfer",
              "reflection",
            ],
          },
          maxItems: 8,
        },
        preferred_pace: {
          type: ["string", "null"],
          enum: ["too_fast", "right", "too_slow", null],
        },
      },
      required: ["consent_confirmed"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "recover_unclear_audio",
    description:
      "Repeat the exact current prompt after missing, clipped, or unclear audio. Never guess and never advance learner state.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "propose_exam_reminder",
    description:
      "Use only when the learner explicitly asks for one SMS exam or review reminder and states enough calendar information. Preserve the exact server transcript in source_text. Never invent a date, time, topic, or consent.",
    parameters: {
      type: "object",
      properties: {
        source_text: { type: "string" },
        topic: { type: "string" },
        due_at: { type: "string", description: "ISO 8601 reminder instant." },
        exam_at: { type: "string", description: "ISO 8601 exam instant." },
        time_zone: {
          type: "string",
          description: "IANA time zone used to interpret the request.",
        },
      },
      required: ["source_text", "topic", "due_at", "exam_at", "time_zone"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "propose_callback_reminder",
    description:
      "Use only when the learner explicitly asks for one SMS reminder to call Continuum back and gives an unambiguous time. Preserve the exact server transcript in source_text. Never invent a time, topic, or consent.",
    parameters: {
      type: "object",
      properties: {
        source_text: { type: "string" },
        topic: { type: "string" },
        due_at: { type: "string", description: "ISO 8601 reminder instant." },
        time_zone: {
          type: "string",
          description: "IANA time zone used to interpret the request.",
        },
      },
      required: ["source_text", "topic", "due_at", "time_zone"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "confirm_sms_reminder",
    description:
      "Use only while the server is asking for explicit consent to the pending one-time SMS reminder. Set consent_confirmed from the learner's yes or no; never infer it from silence.",
    parameters: {
      type: "object",
      properties: {
        consent_confirmed: { type: "boolean" },
      },
      required: ["consent_confirmed"],
      additionalProperties: false,
    },
  },
] as const;

export const OpenTopicRealtimeStageSchema = z.enum([
  "language",
  "identity",
  "open_topic",
]);
export type OpenTopicRealtimeStage = z.infer<
  typeof OpenTopicRealtimeStageSchema
>;

const TOOL_NAMES_BY_STAGE = {
  language: ["select_language", "recover_unclear_audio"],
  identity: ["start_lesson", "recover_unclear_audio"],
  open_topic: [
    "teach_open_topic",
    "record_teaching_feedback",
    "save_learning_preferences",
    "recover_unclear_audio",
    "propose_exam_reminder",
    "propose_callback_reminder",
    "confirm_sms_reminder",
  ],
} as const satisfies Record<OpenTopicRealtimeStage, readonly string[]>;

export function openTopicToolAllowedAtStage(
  stage: OpenTopicRealtimeStage,
  toolName: string,
): boolean {
  return (TOOL_NAMES_BY_STAGE[stage] as readonly string[]).includes(toolName);
}

export interface SelectedRealtimeLanguage {
  languageMode: string;
  displayName: string;
}

export function selectedLanguageInstructions(
  language?: SelectedRealtimeLanguage,
): string {
  if (!language) return OPEN_TOPIC_REALTIME_INSTRUCTIONS;
  return `${OPEN_TOPIC_REALTIME_INSTRUCTIONS}

SELECTED LANGUAGE CONTRACT: The learner explicitly selected ${language.displayName} (${language.languageMode}). Speak only in ${language.displayName}. Do not fall back to English unless English is the selected language. Understand code-switching in learner input, and preserve necessary names, digits, or technical terms, but keep every acknowledgement, identity prompt, recovery prompt, explanation, and question in ${language.displayName}. This contract remains active until the call ends.`;
}

export function buildOpenTopicToolUpdate(
  stage: OpenTopicRealtimeStage,
  language?: SelectedRealtimeLanguage,
) {
  const names = new Set<string>(TOOL_NAMES_BY_STAGE[stage]);
  return {
    type: "session.update" as const,
    session: {
      instructions: selectedLanguageInstructions(language),
      tools: OPEN_TOPIC_REALTIME_TOOLS.filter((tool) => names.has(tool.name)),
      tool_choice: "auto" as const,
    },
  };
}

export const OPEN_TOPIC_REALTIME_INSTRUCTIONS = `You are Continuum's realtime conversation layer. Continuum is one patient teacher reached by an ordinary phone call.
Your only jobs are faithful listening, natural multilingual speech, turn-taking, and calling server tools. The server-side open-topic teaching engine makes every diagnosis, explanation, activity, assessment, memory, and safety decision.

The server speaks the language menu first. Never ask for a name in English before language selection. Call select_language only for an explicit spoken choice, or after star and a spoken unlisted language. Never infer language from silence, noise, location, name, phone number, or accent.

After language selection, remain in the explicitly selected language for the rest of the call. Never fall back to English unless English was selected. A returning learner may enter a six-digit code plus pound; the server completes that keypad identity directly, so follow the resulting open-topic stage and add nothing. Otherwise the server asks for the learner's preferred name. On every identity transcript, call start_lesson immediately and output no audio or conversational text before the tool result. Copy the exact server-verified transcript into source_text without translating or paraphrasing it; learner_name may transliterate a name across scripts. The server will separately ask whether they have a six-digit learner code. Wait. If the learner explicitly says no, call start_lesson again with the same name and omit learner_code. If they speak a complete code, include it. Never send a blank learner_code or turn a name, silence, or partial digits into “no code.”

After identity, the server asks “What would you like to learn?” or resumes the exact unfinished question. There is no subject menu, grade setup, curriculum choice, Guided mode, Curious Sandbox, or duration menu. Do not introduce any of them.

For every substantive learning request, answer, question, or reflection, call teach_open_topic with a faithful transcript. Before the tool call you may say one neutral acknowledgment under six words in the learner's language, but it must not judge, answer, hint, or ask a question. Never invent teaching yourself. Speak the successful tool's spoken_response exactly and add nothing.

When the server asks whether an explanation helped, treat the next response as feedback and call record_teaching_feedback. Do not send it as an academic answer. Save a stated learning preference only after asking permission and receiving an explicit yes.

When the learner explicitly requests a one-time exam/review SMS reminder and gives an unambiguous date and time, call propose_exam_reminder. If they explicitly request a one-time SMS reminder to call Continuum back, call propose_callback_reminder. Never infer a reminder from merely mentioning an exam or intention. The server reads the proposed schedule back and asks for separate consent. While that consent question is pending, call confirm_sms_reminder for a spoken yes or no. Keypad 1 and 2 also work. Never claim a reminder was scheduled before the server confirms it.

If audio is missing, clipped, or uncertain, call recover_unclear_audio. Never guess. Keep conversation management warm, brief, and teacher-like. Never shame the learner or present yourself as a friend, parent, therapist, romantic companion, or replacement for human support.`;

export function buildOpenTopicRealtimeAcceptPayload(
  model = "gpt-realtime-2.1-mini",
  voice = "marin",
  turnDetection: RealtimeTurnDetection = {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 650,
    create_response: false,
    interrupt_response: true,
  },
  speed = 0.8,
  referenceTime?: { nowIso: string; timeZone: string },
): RealtimeAcceptPayload {
  return RealtimeAcceptPayloadSchema.parse({
    type: "realtime",
    model,
    instructions: `${OPEN_TOPIC_REALTIME_INSTRUCTIONS}${
      referenceTime
        ? `\nThe trusted server reference time is ${referenceTime.nowIso}; deployment time zone is ${referenceTime.timeZone}. Use these only to resolve an explicit reminder request.`
        : ""
    }`,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: turnDetection,
      },
      output: { voice, speed },
    },
    tools: OPEN_TOPIC_REALTIME_TOOLS,
    tool_choice: "auto",
  });
}
