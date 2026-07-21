import WebSocket from "ws";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import {
  OPEN_TOPIC_REALTIME_INSTRUCTIONS,
  OPEN_TOPIC_REALTIME_TOOLS,
} from "../telephony/open-topic-realtime.js";

const environment = loadEnvironment();
const apiKey = requireOpenAIKey(environment);
const model = environment.OPENAI_REALTIME_MODEL;
const expectedTools = [
  "select_language",
  "start_lesson",
  "start_lesson",
  "teach_open_topic",
] as const;

await new Promise<void>((resolve, reject) => {
  const socket = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error("Realtime smoke test timed out."));
  }, 30_000);
  let inputSent = false;
  let step = 0;

  function finish(error?: Error): void {
    clearTimeout(timeout);
    socket.close();
    if (error) reject(error);
    else resolve();
  }

  function user(text: string): void {
    socket.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }),
    );
    socket.send(
      JSON.stringify({
        type: "response.create",
        response: { output_modalities: ["text"] },
      }),
    );
  }

  function toolOutput(callId: string, output: Record<string, unknown>): void {
    socket.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      }),
    );
  }

  socket.once("open", () => {
    socket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["text"],
          instructions: OPEN_TOPIC_REALTIME_INSTRUCTIONS,
          tools: OPEN_TOPIC_REALTIME_TOOLS,
          tool_choice: "auto",
        },
      }),
    );
  });

  socket.on("message", (raw) => {
    const event = JSON.parse(raw.toString()) as {
      type?: string;
      error?: { message?: string };
      response?: { output?: unknown[] };
    };
    if (event.type === "error") {
      finish(new Error(event.error?.message ?? "Realtime API error"));
      return;
    }
    if (event.type === "session.updated" && !inputSent) {
      inputSent = true;
      user("English.");
      return;
    }
    if (event.type !== "response.done") return;
    const functionCall = event.response?.output?.find(
      (item): item is { type: string; name: string; call_id: string } =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "function_call" &&
        "name" in item &&
        "call_id" in item,
    );
    const expected = expectedTools[step];
    if (!functionCall || functionCall.name !== expected) {
      finish(
        new Error(
          `Realtime routed to ${functionCall?.name ?? "no tool"}; expected ${expected ?? "completion"}.`,
        ),
      );
      return;
    }
    if (step === 0) {
      toolOutput(functionCall.call_id, {
        ok: true,
        language_selected: true,
        language_mode: "en",
        spoken_response: "What name would you like me to use?",
      });
      step += 1;
      user("My name is Realtime Smoke.");
      return;
    }
    if (step === 1) {
      toolOutput(functionCall.call_id, {
        ok: true,
        identity_complete: false,
        learner_name_saved: true,
        spoken_response:
          "Do you already have a six-digit learner code? If not, say no.",
      });
      step += 1;
      user("No, I do not have a learner code.");
      return;
    }
    if (step === 2) {
      toolOutput(functionCall.call_id, {
        ok: true,
        identity_complete: true,
        open_topic: true,
        spoken_response: "What would you like to learn?",
      });
      step += 1;
      user("Teach me why the moon seems to follow a moving car.");
      return;
    }
    console.log(
      `Realtime language, two-turn identity, and open-topic routing passed on ${model}.`,
    );
    finish();
  });

  socket.once("error", (error) => finish(error));
});
