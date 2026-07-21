import { describe, expect, it } from "vitest";
import { CurriculumCatalog } from "../src/curriculum/catalog.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { CatalogLessonService } from "../src/lesson/catalog-lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  RealtimeTeachingController,
  type RealtimeClientEvent,
} from "../src/telephony/realtime-teaching-bridge.js";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "../src/config/voice-language-menu.js";

const PHONE_HASH_SECRET = "catalog-test-phone-secret";

const sciencePack = CurriculumPackSchema.parse({
  ...fractionsPack,
  id: "india-grade6-science-test-pack",
  deployment: { ...fractionsPack.deployment, subject: "Science" },
  placementDiagnostic: {
    ...fractionsPack.placementDiagnostic,
    questions: fractionsPack.placementDiagnostic.questions.map(
      (question, index) => ({
        ...question,
        id: `science_question_${index + 1}`,
        prompt:
          index === 0
            ? "Which property could you observe to compare paper and a spoon?"
            : question.prompt,
      }),
    ),
    recommendations: {
      foundational: "science_equal_shares",
      developing: "science_comparing_unit_fractions",
      grade_ready: "science_comparing_unit_fractions",
    },
  },
  concepts: fractionsPack.concepts.map((concept) => ({
    ...concept,
    id: `science_${concept.id}`,
    title: `Science: ${concept.title}`,
    teachingScaffold: {
      ...concept.teachingScaffold,
      entryQuestion:
        concept.id === "equal_shares"
          ? "How could you group two objects by an observable property?"
          : "Which property could you observe to compare paper and a spoon?",
    },
  })),
});

function makeService(repository: SqliteLearningRepository) {
  const catalog = new CurriculumCatalog([fractionsPack, sciencePack]);
  return new CatalogLessonService({
    repository,
    catalog,
    phoneHashSecret: PHONE_HASH_SECRET,
    engineFactory: (packId) =>
      new OfflineTeachingEngine(catalog.requireByPackId(packId).pack),
  });
}

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

describe("CatalogLessonService", () => {
  it("builds a metadata-driven subject menu and routes an explicit subject", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = makeService(repository);
    const learner = service.identifyLearner({
      phoneNumber: "+919999900101",
      learnerName: "Subject Learner",
    });

    expect(service.availableSubjects()).toEqual(["Math", "Science"]);
    expect(service.learningMenu({ learner })).toContain(
      "guided subject: Math or Science",
    );
    const science = service.beginOrResumeSubject(learner, "science");
    expect(science.session).toMatchObject({
      curriculumPackId: sciencePack.id,
      concept: "science_comparing_unit_fractions",
      placementLevel: "unplaced",
    });
    expect(service.subjectForContext(science)).toBe("Science");
    expect(service.placementQuestions(science)[0]!.prompt).toContain(
      "paper and a spoon",
    );
    repository.close();
  });

  it("keeps placement and resume state independent across subjects", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = makeService(repository);
    const learner = service.identifyLearner({
      phoneNumber: "+919999900102",
      learnerName: "Two Subject Learner",
    });

    let math = service.beginOrResumeSubject(learner, "Math");
    math = (
      await service.completePlacement(math, [
        { questionId: "equal_shares", answer: "Each gets one half." },
        {
          questionId: "compare_halves_quarters",
          answer: "One half because fewer pieces are bigger.",
        },
        {
          questionId: "compare_thirds_fifths",
          answer: "One third because fewer pieces are bigger.",
        },
      ])
    ).context;
    expect(math.session.placementLevel).toBe("grade_ready");
    math = (
      await service.respond(
        math,
        "One third because fewer equal pieces makes each piece bigger.",
      )
    ).context;
    math = service.pause(math);

    let science = service.beginOrResumeSubject(learner, "Science");
    expect(science.session.placementLevel).toBe("unplaced");
    science = (
      await service.completePlacement(
        science,
        service.placementQuestions(science).map((question) => ({
          questionId: question.id,
          answer: "I do not know.",
        })),
      )
    ).context;
    expect(science.session.placementLevel).toBe("foundational");
    expect((await service.learningHistory(science)).spoken_response).toContain(
      "not recorded",
    );
    science = service.pause(science);

    const resumedMath = service.beginOrResumeSubject(learner, "Math");
    expect(resumedMath).toMatchObject({ resumed: true });
    expect(resumedMath.session).toMatchObject({
      id: math.session.id,
      curriculumPackId: fractionsPack.id,
      placementLevel: "grade_ready",
    });
    expect(
      (await service.learningHistory(resumedMath)).spoken_response,
    ).toContain("Comparing unit fractions");
    const storedScience = repository.findLatestLesson(
      learner.id,
      sciencePack.id,
    );
    expect(storedScience).toMatchObject({
      id: science.session.id,
      placementLevel: "foundational",
    });
    repository.close();
  });

  it("requires a subject before a multi-subject guided session is created", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = makeService(repository);
    const controller = new RealtimeTeachingController({
      callerNumber: "+919999900103",
      lessonService: service,
      modelRoute: "gpt-realtime-2.1-mini",
      languageMenu: DEFAULT_VOICE_LANGUAGE_MENU,
      initialLanguageMode: "en",
    });
    const sent: RealtimeClientEvent[] = [];
    const send = (event: RealtimeClientEvent) => sent.push(event);

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_start",
        name: "start_lesson",
        arguments: { learner_name: "Menu Learner" },
      }),
      send,
    );
    const start = parseToolOutput(sent.at(-2)!);
    expect(start.guided_subjects).toEqual(["Math", "Science"]);

    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_missing_subject",
        name: "choose_learning_mode",
        arguments: { mode: "guided" },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: false,
      guided_subjects: ["Math", "Science"],
    });
    expect(
      repository.findResumableLesson(start.learner_id as string),
    ).toBeUndefined();

    await controller.handleServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "background_noise_audio",
        transcript: "background noise",
      },
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_phantom_science",
        name: "choose_learning_mode",
        arguments: { mode: "guided", subject: "Science" },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: false,
      state_changed: false,
    });
    expect(
      repository.findResumableLesson(start.learner_id as string),
    ).toBeUndefined();

    await controller.handleServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "science_choice_audio",
        transcript: "Science",
      },
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_science",
        name: "choose_learning_mode",
        arguments: { mode: "guided", subject: "science" },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: true,
      selected_subject: "Science",
      pending_duration: true,
      state_changed: false,
    });
    expect(
      repository.findResumableLesson(start.learner_id as string),
    ).toBeUndefined();

    await controller.handleServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "science_duration_audio",
        transcript: "5 minutes",
      },
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_science_duration",
        name: "choose_learning_mode",
        arguments: {
          mode: "guided",
          subject: "science",
          duration_minutes: 5,
        },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: true,
      selected_subject: "Science",
      placement_required: true,
    });
    expect(
      repository.findResumableLesson(start.learner_id as string),
    ).toMatchObject({ curriculumPackId: sciencePack.id });

    await controller.handleServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "math_choice_audio",
        transcript: "Math",
      },
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_switch_math",
        name: "choose_learning_mode",
        arguments: { mode: "guided", subject: "Math" },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: true,
      selected_subject: "Math",
      pending_duration: true,
    });
    await controller.handleServerEvent(
      {
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "math_duration_audio",
        transcript: "3 minutes",
      },
      send,
    );
    await controller.handleServerEvent(
      functionCallEvent({
        callId: "catalog_switch_math_duration",
        name: "choose_learning_mode",
        arguments: {
          mode: "guided",
          subject: "Math",
          duration_minutes: 3,
        },
      }),
      send,
    );
    expect(parseToolOutput(sent.at(-2)!)).toMatchObject({
      ok: true,
      selected_subject: "Math",
      placement_required: true,
    });
    expect(
      repository.findLatestLesson(start.learner_id as string, sciencePack.id),
    ).toMatchObject({ status: "paused" });
    expect(
      repository.findResumableLesson(
        start.learner_id as string,
        fractionsPack.id,
      ),
    ).toMatchObject({ status: "active" });
    await controller.close();
    repository.close();
  });
});
