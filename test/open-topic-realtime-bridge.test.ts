import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "../src/config/voice-language-menu.js";
import { PortableIdentityService } from "../src/domain/portable-identity.js";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  OpenTopicRealtimeController,
  type OpenTopicRealtimeClientEvent,
} from "../src/telephony/open-topic-realtime-bridge.js";
import {
  OPEN_TOPIC_REALTIME_INSTRUCTIONS,
  buildOpenTopicRealtimeAcceptPayload,
} from "../src/telephony/open-topic-realtime.js";

const SECRET = "open-topic-realtime-test-secret";

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

function transcription(id: string, transcript: string): unknown {
  return {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: id,
    transcript,
  };
}

function parseToolOutput(
  events: OpenTopicRealtimeClientEvent[],
): Record<string, unknown> {
  const event = events
    .filter((candidate) => candidate.type === "conversation.item.create")
    .at(-1)!;
  const item = event.item as { output: string };
  return JSON.parse(item.output) as Record<string, unknown>;
}

function fixture(phoneNumber = "+14155550100") {
  const repository = new SqliteLearningRepository(":memory:");
  const service = new OpenTopicLessonService({
    repository,
    engine: new OfflineOpenTopicEngine(),
    phoneHashSecret: SECRET,
  });
  const portableIdentity = new PortableIdentityService({
    repository,
    secret: SECRET,
    phoneHashSecret: SECRET,
    makeCode: () => "482913",
  });
  const controller = new OpenTopicRealtimeController({
    callerNumber: phoneNumber,
    lessonService: service,
    portableIdentity,
    languageMenu: DEFAULT_VOICE_LANGUAGE_MENU,
    modelRoute: "gpt-realtime-2.1-mini",
    dynamicToolRouting: true,
  });
  return { repository, service, portableIdentity, controller };
}

async function startNewLearner(options: {
  controller: OpenTopicRealtimeController;
  sent: OpenTopicRealtimeClientEvent[];
  name?: string;
}): Promise<Record<string, unknown>> {
  const name = options.name ?? "Meena";
  const send = (event: OpenTopicRealtimeClientEvent) => options.sent.push(event);
  await options.controller.handleServerEvent(
    { type: "input_audio_buffer.dtmf_event_received", event: "1" },
    send,
  );
  await options.controller.handleServerEvent(
    transcription("name-audio", name),
    send,
  );
  await options.controller.handleServerEvent(
    functionCallEvent({
      callId: "save-name",
      name: "start_lesson",
      arguments: { learner_name: name },
    }),
    send,
  );
  await options.controller.handleServerEvent(
    transcription("no-code-audio", "No, I do not have a code."),
    send,
  );
  await options.controller.handleServerEvent(
    functionCallEvent({
      callId: "complete-identity",
      name: "start_lesson",
      arguments: { learner_name: name },
    }),
    send,
  );
  return parseToolOutput(options.sent);
}

describe("open-topic Realtime call path", () => {
  it("accepts only the language, identity, open teaching, feedback, preference, and recovery tools", () => {
    const payload = buildOpenTopicRealtimeAcceptPayload();
    expect(payload.tools.map((tool) => tool.name)).toEqual([
      "select_language",
      "start_lesson",
      "teach_open_topic",
      "record_teaching_feedback",
      "save_learning_preferences",
      "recover_unclear_audio",
    ]);
    expect(OPEN_TOPIC_REALTIME_INSTRUCTIONS).toContain(
      "What would you like to learn?",
    );
    expect(OPEN_TOPIC_REALTIME_INSTRUCTIONS).toContain(
      "There is no subject menu",
    );
    expect(OPEN_TOPIC_REALTIME_INSTRUCTIONS).not.toContain(
      "choose a guided subject",
    );
  });

  it("goes from language and identity directly to one open learning prompt", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];

    expect(controller.openingStage()).toBe("language");
    expect(JSON.stringify(controller.openingEvent())).toContain(
      "हिंदी के लिए 2",
    );
    const output = await startNewLearner({ controller, sent });

    expect(controller.openingStage()).toBe("open_topic");
    expect(output).toMatchObject({
      ok: true,
      identity_complete: true,
      open_topic: true,
      portable_code_issued: "482913",
    });
    expect(output.spoken_response).toContain("What would you like to learn?");
    expect(JSON.stringify(output)).not.toMatch(
      /guided math|science menu|curious sandbox|grade|minutes/iu,
    );
    expect(repository.listRecentLessons(10)).toHaveLength(1);
    expect(repository.listRecentLessons(10)[0]).toMatchObject({
      concept: "open-topic",
      curriculumPackId: "continuum-open-topic-v1",
    });

    await controller.close();
    repository.close();
  });

  it("allows an explicitly requested unlisted language after star", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "*" },
      send,
    );
    await controller.handleServerEvent(
      transcription("unlisted-language", "Kinyarwanda"),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "choose-unlisted",
        name: "select_language",
        arguments: { language_mode: "rw" },
      }),
      send,
    );
    expect(controller.openingStage()).toBe("identity");
    expect(parseToolOutput(sent)).toMatchObject({
      ok: true,
      language_selected: true,
      language_mode: "rw",
    });
    await controller.close();
    repository.close();
  });

  it("uses the verified server transcript instead of model-supplied teaching text", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent, name: "Daniel" });

    await controller.handleServerEvent(
      transcription("topic-audio", "Teach me why the moon appears to follow us."),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "teach-topic",
        name: "teach_open_topic",
        arguments: { learner_input: "Teach me the old guided science pack." },
      }),
      send,
    );
    const output = parseToolOutput(sent);
    const plan = (output.pedagogy_decision as { openTopicPlan: { topic: string } })
      .openTopicPlan;

    expect(plan.topic).toContain("moon appears to follow us");
    expect(plan.topic).not.toContain("guided science pack");
    expect(output.learning_activity).toMatchObject({
      kind: "socratic_prompt",
    });
    const session = repository.listRecentLessons(10)[0]!;
    expect(repository.listTurns(session.id)).toHaveLength(1);

    await controller.close();
    repository.close();
  });

  it("does not change lesson state on silence and repeats the saved prompt on zero", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent });
    const session = repository.listRecentLessons(10)[0]!;
    const before = repository.listTurns(session.id).length;

    await controller.handleServerEvent(transcription("silence", "   "), send);
    expect(repository.listTurns(session.id)).toHaveLength(before);
    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "0" },
      send,
    );
    expect(JSON.stringify(sent.at(-1))).toContain("What would you like to learn?");
    expect(repository.listTurns(session.id)).toHaveLength(before);

    await controller.close();
    repository.close();
  });

  it("stores keypad feedback and uses a different method on the next turn", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent });
    for (const [id, words] of [
      ["topic", "Teach me how rain forms."],
      ["idea", "I think clouds are bags that open."],
    ] as const) {
      await controller.handleServerEvent(transcription(id, words), send);
      await controller.handleServerEvent(
        functionCallEvent({
          callId: `teach-${id}`,
          name: "teach_open_topic",
          arguments: { learner_input: words },
        }),
        send,
      );
    }
    expect(String(parseToolOutput(sent).spoken_response)).toContain(
      "press 1 for yes or 2 for no",
    );

    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "2" },
      send,
    );
    const learner = repository.listRecentLessons(10)[0]!;
    expect(repository.listTeachingFeedback(learner.learnerId, 10)[0]).toMatchObject({
      helpfulness: "not_helpful",
      responseMode: "dtmf",
    });

    await controller.handleServerEvent(
      transcription("after-feedback", "That part is still confusing."),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "teach-after-feedback",
        name: "teach_open_topic",
        arguments: { learner_input: "That part is still confusing." },
      }),
      send,
    );
    const changed = parseToolOutput(sent);
    expect(changed.next_strategy).toBe("concrete_analogy");
    expect(changed.learning_activity).toMatchObject({ kind: "analogy" });

    await controller.close();
    repository.close();
  });

  it("resumes the exact pending question from another phone with the portable code", async () => {
    const first = fixture("+14155550101");
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller: first.controller, sent, name: "Asha" });
    await first.controller.handleServerEvent(
      transcription("first-topic", "Teach me why leaves look green."),
      send,
    );
    await first.controller.handleServerEvent(
      functionCallEvent({
        callId: "first-teach",
        name: "teach_open_topic",
        arguments: { learner_input: "Teach me why leaves look green." },
      }),
      send,
    );
    const pending = first.repository.listRecentLessons(10)[0]!.lastPrompt;
    await first.controller.close();

    const second = new OpenTopicRealtimeController({
      callerNumber: "+14155550199",
      lessonService: first.service,
      portableIdentity: first.portableIdentity,
      languageMenu: DEFAULT_VOICE_LANGUAGE_MENU,
      modelRoute: "gpt-realtime-2.1-mini",
      dynamicToolRouting: true,
    });
    const resumedEvents: OpenTopicRealtimeClientEvent[] = [];
    const sendResumed = (event: OpenTopicRealtimeClientEvent) =>
      resumedEvents.push(event);
    await second.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "1" },
      sendResumed,
    );
    for (const digit of "482913#") {
      await second.handleServerEvent(
        { type: "input_audio_buffer.dtmf_event_received", event: digit },
        sendResumed,
      );
    }
    await second.handleServerEvent(
      transcription("confirm-name", "Asha"),
      sendResumed,
    );
    await second.handleServerEvent(
      functionCallEvent({
        callId: "confirm-portable",
        name: "start_lesson",
        arguments: { learner_name: "Asha" },
      }),
      sendResumed,
    );
    const resumed = parseToolOutput(resumedEvents);
    expect(resumed).toMatchObject({ resumed: true, portable_code_issued: null });
    expect(String(resumed.spoken_response)).toContain(pending);
    expect(first.repository.listRecentLessons(10)[0]!.lastPrompt).toBe(pending);

    await second.close();
    first.repository.close();
  });
});
