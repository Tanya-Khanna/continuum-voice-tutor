import { describe, expect, it, vi } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  RealtimeTeachingController,
  type RealtimeClientEvent,
  usageFromRealtimeEvent,
} from "../src/telephony/realtime-teaching-bridge.js";

const PHONE_HASH_SECRET = "realtime-test-secret-12345";

function functionCallEvent(options: {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}): unknown {
  return {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      name: options.name,
      call_id: options.callId,
      arguments: JSON.stringify(options.arguments),
    },
  };
}

function parseToolOutput(event: RealtimeClientEvent): Record<string, unknown> {
  const item = event.item as { output: string };
  return JSON.parse(item.output) as Record<string, unknown>;
}

describe("Realtime teaching controller", () => {
  it("separates Realtime text, cached, and audio usage", () => {
    expect(
      usageFromRealtimeEvent(
        {
          type: "response.done",
          response: {
            id: "resp_voice",
            output: [],
            usage: {
              input_tokens: 170,
              output_tokens: 70,
              input_token_details: {
                text_tokens: 70,
                audio_tokens: 100,
                cached_tokens: 50,
                cached_tokens_details: { text_tokens: 20, audio_tokens: 30 },
              },
              output_token_details: { text_tokens: 30, audio_tokens: 40 },
            },
          },
        },
        "gpt-realtime-2.1-mini",
      ),
    ).toMatchObject({
      providerResponseId: "resp_voice",
      inputTextTokens: 70,
      cachedInputTextTokens: 20,
      outputTextTokens: 30,
      inputAudioTokens: 100,
      cachedInputAudioTokens: 30,
      outputAudioTokens: 40,
    });
  });

  it("starts a named profile, delegates every teaching turn, and pauses on close", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: PHONE_HASH_SECRET,
      curriculumPack: fractionsPack,
    });
    const controller = new RealtimeTeachingController({
      callerNumber: "+919999900001",
      lessonService: service,
      modelRoute: "gpt-realtime-2.1-mini",
    });
    const sent: RealtimeClientEvent[] = [];

    await controller.handleServerEvent(
      {
        type: "response.done",
        response: {
          id: "resp_opening",
          output: [],
          usage: {
            input_tokens: 12,
            output_tokens: 8,
            input_token_details: { text_tokens: 12, audio_tokens: 0 },
            output_token_details: { text_tokens: 2, audio_tokens: 6 },
          },
        },
      },
      (event) => sent.push(event),
    );

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_start",
        name: "start_lesson",
        arguments: { learner_name: "Ravi", language_mode: "hi-Latn+en" },
      }),
      (event) => sent.push(event),
    );

    const startOutput = parseToolOutput(sent[0]!);
    expect(startOutput).toMatchObject({ ok: true, resumed: false });
    expect(startOutput.spoken_response).toContain("Ravi");
    expect(startOutput.spoken_response).toContain("guided Math");
    expect(startOutput.menu_options).toEqual(["guided", "curious_sandbox"]);
    const startedSession = repository.findResumableLesson(
      startOutput.learner_id as string,
    );
    expect(startedSession).toBeDefined();
    expect(repository.listUsage(startedSession!.id)).toHaveLength(1);

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_mode",
        name: "choose_learning_mode",
        arguments: { mode: "guided" },
      }),
      (event) => sent.push(event),
    );
    const modeOutput = parseToolOutput(sent[2]!);
    expect(modeOutput).toMatchObject({
      ok: true,
      mode: "guided",
      placement_required: true,
    });
    expect(modeOutput.spoken_response).toContain("shared equally");
    expect(sent[3]).toMatchObject({
      type: "response.create",
      response: {
        instructions: expect.stringContaining("authoritative onboarding copy"),
      },
    });

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_placement",
        name: "complete_placement",
        arguments: {
          answers: [
            { question_id: "equal_shares", answer: "Each gets one half." },
            {
              question_id: "compare_halves_quarters",
              answer: "One half, because two pieces are bigger pieces.",
            },
            {
              question_id: "compare_thirds_fifths",
              answer: "One third, because fewer pieces means bigger pieces.",
            },
          ],
        },
      }),
      (event) => sent.push(event),
    );
    const placementOutput = parseToolOutput(sent[4]!);
    expect(placementOutput).toMatchObject({
      ok: true,
      placement_required: false,
      placement_level: "grade_ready",
      placement_score: 3,
      placement_total: 3,
    });
    expect(placementOutput.spoken_response).toContain("Which is the bigger share");

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_teach",
        name: "get_teaching_turn",
        arguments: {
          learner_answer:
            "Mujhe lagta hai one fourth bigger hai because four is bigger.",
        },
      }),
      (event) => sent.push(event),
    );

    const turnOutput = parseToolOutput(sent[6]!);
    expect(turnOutput).toMatchObject({
      ok: true,
      language_mode: "hi-Latn+en",
      mastery_status: "needs_support",
    });
    expect(sent[7]).toMatchObject({ type: "response.create" });

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_history",
        name: "get_learning_history",
        arguments: {},
      }),
      (event) => sent.push(event),
    );
    const historyOutput = parseToolOutput(sent[8]!);
    expect(historyOutput).toMatchObject({ ok: true, language_mode: "hi-Latn+en" });
    expect(historyOutput.spoken_response).toContain("Comparing unit fractions");

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "call_sandbox",
        name: "get_sandbox_turn",
        arguments: { learner_question: "Why do stars look small?" },
      }),
      (event) => sent.push(event),
    );
    const sandboxOutput = parseToolOutput(sent[10]!);
    expect(sandboxOutput).toMatchObject({
      ok: true,
      mode: "curious_sandbox",
      certainty: "low",
      safety_status: "safe",
    });
    expect(repository.listSandboxTurns(startedSession!.id)).toHaveLength(1);

    await controller.close();
    const learnerId = startOutput.learner_id as string;
    expect(repository.findResumableLesson(learnerId)?.status).toBe("paused");
    repository.close();
  });

  it("handles duplicate function-call lifecycle events only once", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: PHONE_HASH_SECRET,
      curriculumPack: fractionsPack,
    });
    const controller = new RealtimeTeachingController({
      callerNumber: "+14155550100",
      lessonService: service,
      modelRoute: "gpt-realtime-2.1-mini",
    });
    const send = vi.fn<(event: RealtimeClientEvent) => void>();
    const item = {
      type: "function_call",
      name: "start_lesson",
      call_id: "same_call",
      arguments: JSON.stringify({ learner_name: "Asha" }),
    };

    await controller.handleServerEvent(
      { type: "response.output_item.done", item },
      send,
    );
    await controller.handleServerEvent(
      { type: "response.done", response: { output: [item] } },
      send,
    );

    expect(send).toHaveBeenCalledTimes(2);
    await controller.close();
    repository.close();
  });

  it("does not teach before the caller chooses a learning mode", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: PHONE_HASH_SECRET,
      curriculumPack: fractionsPack,
    });
    const controller = new RealtimeTeachingController({
      callerNumber: "+14155550101",
      lessonService: service,
      modelRoute: "gpt-realtime-2.1-mini",
    });
    const sent: RealtimeClientEvent[] = [];
    const send = (event: RealtimeClientEvent) => sent.push(event);

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "start_before_mode",
        name: "start_lesson",
        arguments: { learner_name: "Mode Tester" },
      }),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "teach_before_mode",
        name: "get_teaching_turn",
        arguments: { learner_answer: "One third." },
      }),
      send,
    );

    const blocked = parseToolOutput(sent[2]!);
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.spoken_response).toContain("guided Math");
    const learnerId = parseToolOutput(sent[0]!).learner_id as string;
    const session = repository.findResumableLesson(learnerId);
    expect(repository.listTurns(session!.id)).toHaveLength(0);
    await controller.close();
    repository.close();
  });
});
