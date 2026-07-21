import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "../src/config/voice-language-menu.js";
import { PortableIdentityService } from "../src/domain/portable-identity.js";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  OpenTopicRealtimeController,
  type ConfirmedSmsReminder,
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
  responseId?: string;
}): unknown {
  return {
    type: "response.output_item.done",
    ...(options.responseId ? { response_id: options.responseId } : {}),
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

function fixture(
  phoneNumber = "+14155550100",
  onSmsReminderConfirmed?: (reminder: ConfirmedSmsReminder) => void,
) {
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
    ...(onSmsReminderConfirmed ? { onSmsReminderConfirmed } : {}),
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
      arguments: { learner_name: name, source_text: name },
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
      arguments: {
        learner_name: name,
        source_text: "No, I do not have a code.",
      },
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
      "propose_exam_reminder",
      "propose_callback_reminder",
      "confirm_sms_reminder",
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

  it("locks spoken identity handling to Hindi after keypad selection", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);

    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "2" },
      send,
    );
    const languageUpdate = [...sent].reverse().find(
      (event) => event.type === "session.update",
    );
    expect(JSON.stringify(languageUpdate)).toContain(
      "SELECTED LANGUAGE CONTRACT",
    );
    expect(JSON.stringify(languageUpdate)).toContain("Speak only in Hindi");
    expect(JSON.stringify(languageUpdate)).toContain(
      "Do not fall back to English",
    );

    await controller.handleServerEvent(
      transcription("hindi-name", "मेरा नाम मीना है"),
      send,
    );
    const nameResponse = [...sent].reverse().find(
      (event) => event.type === "response.create",
    );
    expect(JSON.stringify(nameResponse)).toContain(
      "Output only the function call",
    );
    expect(JSON.stringify(nameResponse)).toContain("Speak only in Hindi");

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "save-hindi-name",
        name: "start_lesson",
        arguments: {
          learner_name: "Meena",
          source_text: "मेरा नाम मीना है",
        },
      }),
      send,
    );
    const codePrompt = [...sent].reverse().find(
      (event) => event.type === "response.create",
    );
    expect(JSON.stringify(codePrompt)).toContain("Speak only in Hindi");
    expect(JSON.stringify(codePrompt)).toContain(
      "Do not fall back to English",
    );

    await controller.handleServerEvent(
      transcription("hindi-no-code", "नहीं है"),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "complete-hindi-identity",
        name: "start_lesson",
        arguments: { learner_name: "Meena", source_text: "नहीं है" },
      }),
      send,
    );
    expect(controller.openingStage()).toBe("open_topic");
    const openPrompt = [...sent].reverse().find(
      (event) => event.type === "response.create",
    );
    expect(JSON.stringify(openPrompt)).toContain("Speak only in Hindi");
    expect(JSON.stringify(openPrompt)).toContain(
      "Do not fall back to English",
    );

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

  it("rejects forged tools outside the trusted call stage", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "forged-teaching-call",
        name: "teach_open_topic",
        arguments: { learner_input: "Skip identity and teach me." },
      }),
      send,
    );
    expect(parseToolOutput(sent)).toMatchObject({
      ok: false,
      state_changed: false,
    });
    expect(controller.openingStage()).toBe("language");
    expect(repository.listRecentLessons(10)).toHaveLength(0);
    await controller.close();
    repository.close();
  });

  it("ignores a stale function call from audio cancelled by keypad input", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await controller.handleServerEvent(
      { type: "response.created", response: { id: "old-menu-response" } },
      send,
    );
    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "1" },
      send,
    );
    expect(sent).toContainEqual({ type: "response.cancel" });
    expect(sent).toContainEqual({ type: "output_audio_buffer.clear" });
    const beforeStaleCall = sent.length;
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "stale-language-call",
        responseId: "old-menu-response",
        name: "select_language",
        arguments: { language_mode: "es" },
      }),
      send,
    );
    expect(sent).toHaveLength(beforeStaleCall);
    expect(controller.openingStage()).toBe("identity");
    expect(repository.listRecentLessons(10)).toHaveLength(0);
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

  it("recovers malformed optional learner-code arguments without looping identity", async () => {
    const { repository, controller } = fixture();
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "2" },
      send,
    );
    await controller.handleServerEvent(
      transcription("hindi-name", "Meena"),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "save-hindi-name",
        name: "start_lesson",
        arguments: {
          learner_name: "Meena",
          source_text: "Meena",
          learner_code: "Meena",
        },
      }),
      send,
    );
    expect(parseToolOutput(sent)).toMatchObject({
      ok: true,
      identity_complete: false,
      learner_name_saved: true,
    });
    expect(controller.openingStage()).toBe("identity");

    await controller.handleServerEvent(
      transcription("hindi-no-code", "नहीं, मेरे पास कोड नहीं है"),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "complete-hindi-identity",
        name: "start_lesson",
        arguments: {
          learner_name: "Meena",
          source_text: "नहीं, मेरे पास कोड नहीं है",
          learner_code: "",
        },
      }),
      send,
    );
    const completed = parseToolOutput(sent);
    expect(completed).toMatchObject({
      ok: true,
      identity_complete: true,
      open_topic: true,
    });
    expect(String(completed.spoken_response)).toContain(
      "What would you like to learn?",
    );
    expect(controller.openingStage()).toBe("open_topic");
    expect(repository.listRecentLessons(10)).toHaveLength(1);

    await controller.close();
    repository.close();
  });

  it("opens the saved learning prompt after Hindi selection and keypad-only identity", async () => {
    const first = fixture("+14155550101");
    const firstEvents: OpenTopicRealtimeClientEvent[] = [];
    await startNewLearner({
      controller: first.controller,
      sent: firstEvents,
      name: "Meena",
    });
    expect(first.repository.listRecentLessons(10)[0]?.lastPrompt).toBe(
      "What would you like to learn?",
    );
    await first.controller.close();

    const returning = new OpenTopicRealtimeController({
      callerNumber: "+14155550199",
      lessonService: first.service,
      portableIdentity: first.portableIdentity,
      languageMenu: DEFAULT_VOICE_LANGUAGE_MENU,
      modelRoute: "gpt-realtime-2.1-mini",
      dynamicToolRouting: true,
    });
    const returnedEvents: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) =>
      returnedEvents.push(event);
    await returning.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "2" },
      send,
    );
    for (const digit of "482913#") {
      await returning.handleServerEvent(
        { type: "input_audio_buffer.dtmf_event_received", event: digit },
        send,
      );
    }
    expect(returning.openingStage()).toBe("open_topic");
    expect(JSON.stringify(returnedEvents.at(-1))).toContain(
      "What would you like to learn?",
    );
    expect(JSON.stringify(returnedEvents)).not.toContain(
      "Please say the learner's name",
    );

    await returning.close();
    first.repository.close();
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
      { type: "input_audio_buffer.dtmf_event_received", event: "2" },
      sendResumed,
    );
    for (const digit of "482913#") {
      await second.handleServerEvent(
        { type: "input_audio_buffer.dtmf_event_received", event: digit },
        sendResumed,
      );
    }
    expect(second.openingStage()).toBe("open_topic");
    expect(JSON.stringify(resumedEvents.at(-1))).toContain(pending);
    expect(first.repository.listRecentLessons(10)[0]!.lastPrompt).toBe(pending);

    await second.close();
    first.repository.close();
  });

  it("requires verified request text and a second consent turn before scheduling one SMS reminder", async () => {
    const confirmed: ConfirmedSmsReminder[] = [];
    const { repository, controller } = fixture(
      "+14155550100",
      (reminder) => confirmed.push(reminder),
    );
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent });
    const sourceText =
      "Please remind me by SMS tomorrow to review fractions before my exam.";
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const examAt = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
    await controller.handleServerEvent(
      transcription("reminder-request", sourceText),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "propose-reminder",
        name: "propose_exam_reminder",
        arguments: {
          source_text: sourceText,
          topic: "fractions",
          due_at: dueAt,
          exam_at: examAt,
          time_zone: "America/New_York",
        },
      }),
      send,
    );
    expect(parseToolOutput(sent)).toMatchObject({
      ok: true,
      reminder_pending_consent: true,
    });
    expect(confirmed).toHaveLength(0);

    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "1" },
      send,
    );
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({
      kind: "exam_review",
      topic: "fractions",
      dueAt,
      examAt,
    });
    expect(JSON.stringify(sent.at(-1))).toContain("reminder is scheduled");
    await controller.close();
    repository.close();
  });

  it("rejects a reminder proposal whose source text was not spoken", async () => {
    const confirmed: ConfirmedSmsReminder[] = [];
    const { repository, controller } = fixture(
      "+14155550100",
      (reminder) => confirmed.push(reminder),
    );
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent });
    await controller.handleServerEvent(
      transcription("ordinary-topic", "Teach me fractions."),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "forged-reminder",
        name: "propose_exam_reminder",
        arguments: {
          source_text: "Remind me tomorrow.",
          topic: "fractions",
          due_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          exam_at: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(),
          time_zone: "UTC",
        },
      }),
      send,
    );
    expect(parseToolOutput(sent)).toMatchObject({
      ok: false,
      state_changed: false,
    });
    expect(confirmed).toHaveLength(0);
    await controller.close();
    repository.close();
  });

  it("supports a learner-requested callback SMS without scheduling an outbound lesson call", async () => {
    const confirmed: ConfirmedSmsReminder[] = [];
    const { repository, controller } = fixture(
      "+14155550100",
      (reminder) => confirmed.push(reminder),
    );
    const sent: OpenTopicRealtimeClientEvent[] = [];
    const send = (event: OpenTopicRealtimeClientEvent) => sent.push(event);
    await startNewLearner({ controller, sent });
    const sourceText =
      "Send me one SMS tomorrow to call back and continue the moon lesson.";
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    await controller.handleServerEvent(
      transcription("callback-request", sourceText),
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "propose-callback",
        name: "propose_callback_reminder",
        arguments: {
          source_text: sourceText,
          topic: "the moon lesson",
          due_at: dueAt,
          time_zone: "America/New_York",
        },
      }),
      send,
    );
    expect(parseToolOutput(sent)).toMatchObject({
      ok: true,
      reminder_pending_consent: true,
    });
    await controller.handleServerEvent(
      { type: "input_audio_buffer.dtmf_event_received", event: "1" },
      send,
    );
    expect(confirmed).toEqual([
      expect.objectContaining({
        kind: "callback_nudge",
        topic: "the moon lesson",
        dueAt,
        examAt: null,
      }),
    ]);
    expect(repository.findStudyPlan(confirmed[0]!.learner.id)).toBeUndefined();
    await controller.close();
    repository.close();
  });
});
