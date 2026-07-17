import { describe, expect, it, vi } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  RealtimeTeachingController,
  type RealtimeClientEvent,
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
    });
    const sent: RealtimeClientEvent[] = [];

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

    const turnOutput = parseToolOutput(sent[2]!);
    expect(turnOutput).toMatchObject({
      ok: true,
      language_mode: "hi-Latn+en",
      mastery_status: "needs_support",
    });
    expect(sent[3]).toMatchObject({ type: "response.create" });

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
});
