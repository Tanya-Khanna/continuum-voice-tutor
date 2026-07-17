import WebSocket from "ws";
import { loadEnvironment, requireOpenAIKey } from "../config/env.js";
import {
  REALTIME_CONVERSATION_INSTRUCTIONS,
  REALTIME_TEACHING_TOOLS,
} from "../telephony/realtime-sip.js";

const environment = loadEnvironment();
const apiKey = requireOpenAIKey(environment);
const model = "gpt-realtime-2.1-mini";

await new Promise<void>((resolve, reject) => {
  const socket = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const timeout = setTimeout(() => {
    socket.close();
    reject(new Error("Realtime smoke test timed out."));
  }, 20_000);
  let inputSent = false;
  let expectedTool:
    | "start_lesson"
    | "choose_learning_mode"
    | "complete_placement" = "start_lesson";

  function finish(error?: Error): void {
    clearTimeout(timeout);
    socket.close();
    if (error) reject(error);
    else resolve();
  }

  socket.once("open", () => {
    socket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["text"],
          instructions: REALTIME_CONVERSATION_INSTRUCTIONS,
          tools: REALTIME_TEACHING_TOOLS,
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
      socket.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "My name is Realtime Smoke.",
              },
            ],
          },
        }),
      );
      socket.send(
        JSON.stringify({
          type: "response.create",
          response: { output_modalities: ["text"] },
        }),
      );
      return;
    }
    if (event.type === "response.done") {
      const functionCall = event.response?.output?.find(
        (item): item is { type: string; name?: string; call_id?: string } =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          item.type === "function_call",
      );
      if (!functionCall) {
        finish(new Error("Realtime response contained no function call."));
        return;
      }
      if (functionCall.name !== expectedTool) {
        finish(
          new Error(
            `Realtime routed to ${functionCall.name ?? "no named tool"}, expected ${expectedTool}.`,
          ),
        );
        return;
      }
      if (!functionCall.call_id) {
        finish(new Error(`${expectedTool} returned no call ID.`));
        return;
      }
      if (expectedTool === "start_lesson") {
        expectedTool = "choose_learning_mode";
        socket.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCall.call_id,
              output: JSON.stringify({
                ok: true,
                menu_options: ["guided", "curious_sandbox"],
                spoken_response:
                  "Would you like guided Math, or Curious Sandbox?",
              }),
            },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "Guided Math, please." }],
            },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.create",
            response: { output_modalities: ["text"] },
          }),
        );
        return;
      }
      if (expectedTool === "choose_learning_mode") {
        expectedTool = "complete_placement";
        socket.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCall.call_id,
              output: JSON.stringify({
                ok: true,
                mode: "guided",
                placement_required: true,
                placement_questions: [
                  {
                    id: "equal_shares",
                    prompt: "What share does each of two people receive?",
                  },
                  {
                    id: "compare_halves_quarters",
                    prompt: "Which is larger, one half or one fourth, and why?",
                  },
                  {
                    id: "compare_thirds_fifths",
                    prompt: "Which is larger, one third or one fifth, and why?",
                  },
                ],
                spoken_response:
                  "What share does each of two people receive?",
              }),
            },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "My placement answers are: equal_shares: one half; compare_halves_quarters: one half because fewer pieces are bigger; compare_thirds_fifths: one third because fewer pieces are bigger.",
                },
              ],
            },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.create",
            response: { output_modalities: ["text"] },
          }),
        );
        return;
      }
      console.log(
        `Realtime text-only name, menu, and placement routing passed on ${model}.`,
      );
      finish();
    }
  });

  socket.once("error", (error) => finish(error));
});
