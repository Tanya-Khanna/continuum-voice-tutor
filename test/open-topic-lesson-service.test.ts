import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  OpenTopicModelTurn,
  OpenTopicRequest,
} from "../src/domain/open-topic.js";
import { OpenTopicModelTurnSchema } from "../src/domain/open-topic.js";
import type { OpenTopicTeachingEngine } from "../src/engine/open-topic-engine.js";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

class TestOpenTopicEngine implements OpenTopicTeachingEngine {
  readonly modelRoute = "test-open-topic";
  requests: OpenTopicRequest[] = [];

  async teachOpenTopic(request: OpenTopicRequest) {
    this.requests.push(request);
    const topic = request.currentTopic ?? "fractions";
    const shared: Pick<
      OpenTopicModelTurn,
      | "learningIntent"
      | "topicPlan"
      | "diagnosisBasis"
      | "misconception"
      | "languageMode"
      | "smsFollowUp"
      | "humanSupport"
      | "shouldEndSession"
    > = {
      learningIntent: {
        learnerWords: request.learnerInput,
        topicOrQuestion: topic,
        desiredOutcome: "understand",
        statedTimeConstraint: null,
        languageMode: "en",
        codeSwitchingObserved: false,
        safetyFlags: [],
      },
      topicPlan: {
        topic,
        objective: "Understand how equal parts change size.",
        priorKnowledgeQuestion: "What do you already think a fraction means?",
        prerequisites: ["equal sharing"],
        possibleMisconceptions: ["a larger denominator always means more"],
        candidateMethods: ["socratic_prompt", "analogy", "teach_back"],
        transferGoal: "Compare a new pair of unit fractions.",
        knowledgeState: "stable",
      },
      diagnosisBasis: "learner_reasoning",
      misconception: null,
      languageMode: "en",
      smsFollowUp: null,
      humanSupport: "none",
      shouldEndSession: false,
    };
    const turn: OpenTopicModelTurn =
      request.phase === "diagnose"
        ? {
            ...shared,
            diagnosis: "No fraction reasoning has been supplied yet.",
            diagnosisBasis: "no_evidence",
            misconception: null,
            strategy: "ask_reasoning",
            strategyReason: "Start from the learner's current idea.",
            activityKind: "socratic_prompt",
            spokenResponse: "What do you already think a fraction means?",
            nextQuestion: "What do you already think a fraction means?",
            evidenceKind: "diagnostic",
            evidenceResult: "unclear",
            masteryStatus: "needs_support",
            masteryEvidence: "The learner requested a topic only.",
            keypadChoices: [],
            expectedChoiceKey: null,
          }
        : request.phase === "transfer"
          ? {
              ...shared,
              diagnosis: "The learner needs independent transfer evidence.",
              strategy: "transfer",
              strategyReason: "Use a new comparison.",
              activityKind: "transfer",
              spokenResponse:
                "Press 1 for one half, or 2 for one fifth. Which share is larger?",
              nextQuestion: "Which share is larger?",
              evidenceKind: "transfer",
              evidenceResult: "correct",
              masteryStatus: "secure",
              masteryEvidence: "The learner chose the expected option.",
              keypadChoices: [
                { key: "1", label: "one half", reviewedAnswerId: null },
                { key: "2", label: "one fifth", reviewedAnswerId: null },
              ],
              expectedChoiceKey: "1",
            }
          : {
              ...shared,
              diagnosis: "The learner is comparing labels instead of share sizes.",
              strategy:
                request.latestFeedback?.helpfulness === "not_helpful"
                  ? "concrete_analogy"
                  : "smaller_step",
              strategyReason: "Use equal sharing to make size visible.",
              activityKind:
                request.latestFeedback?.helpfulness === "not_helpful"
                  ? "analogy"
                  : "hint",
              spokenResponse:
                "Imagine sharing one roti equally. What happens to each piece when more people share it?",
              nextQuestion:
                "What happens to each piece when more people share it?",
              evidenceKind: "guided_practice",
              evidenceResult: "partial",
              masteryStatus: "developing",
              masteryEvidence: "The learner supplied a relevant comparison.",
              keypadChoices: [],
              expectedChoiceKey: null,
            };
    return { value: turn };
  }
}

function fixture() {
  const repository = new SqliteLearningRepository(":memory:");
  const engine = new TestOpenTopicEngine();
  let id = 0;
  const service = new OpenTopicLessonService({
    repository,
    engine,
    phoneHashSecret: "open-topic-test-secret",
    makeId: () => `id-${++id}`,
  });
  return { repository, engine, service };
}

describe("open-topic lesson service", () => {
  it("exposes a Structured Outputs-compatible intent, plan, activity, and evidence contract", () => {
    expect(() =>
      zodTextFormat(OpenTopicModelTurnSchema, "continuum_open_topic_turn"),
    ).not.toThrow();
  });

  it("starts with one open question and no curriculum pack", async () => {
    const { repository, engine, service } = fixture();
    const learner = service.identifyLearner({
      phoneNumber: "+14155550100",
      learnerName: "Meena",
      preferredLanguage: "en",
    });
    const context = service.beginOrResumeLearner(learner);

    expect(context.greeting).toBe("What would you like to learn?");
    expect(context.session.concept).toBe("open-topic");
    const response = await service.respond(context, "Teach me fractions.");

    expect(response.turn.concept).toBe("fractions");
    expect(response.turn.next_strategy).toBe("ask_reasoning");
    expect(response.evidence.result).toBe("unclear");
    expect(engine.requests[0]).toMatchObject({
      phase: "diagnose",
      currentTopic: null,
    });
    expect(response.decision.openTopicPlan).toMatchObject({ topic: "fractions" });
    expect(response.context.session.curriculumPackId).toBe(
      "continuum-open-topic-v1",
    );
    repository.close();
  });

  it("requires a different method after not-helpful feedback", async () => {
    const { repository, service } = fixture();
    const learner = service.identifyLearner({
      phoneNumber: "+14155550101",
      learnerName: "Asha",
    });
    let context = service.beginOrResumeLearner(learner);
    context = (await service.respond(context, "Teach me fractions.")).context;
    context = (await service.respond(context, "The bottom number is bigger.")).context;
    service.recordTeachingFeedback(context, {
      helpfulness: "not_helpful",
      objectiveResult: "incorrect",
    });

    const changed = await service.respond(context, "That did not help.");
    expect(changed.decision.strategyChanged).toBe(true);
    expect(changed.turn.next_strategy).toBe("concrete_analogy");
    expect(changed.decision.strategyReason).toContain("different method");
    repository.close();
  });

  it("caps keypad-only transfer at developing", async () => {
    const { repository, service } = fixture();
    const learner = service.identifyLearner({
      phoneNumber: "+14155550102",
      learnerName: "Ravi",
    });
    let context = service.beginOrResumeLearner(learner);
    context = (await service.respond(context, "Teach me fractions.")).context;
    context = (await service.respond(context, "Equal parts.")).context;
    context = {
      ...context,
      session: {
        ...context.session,
        lastStrategy: "teach_back",
        masteryStatus: "developing",
      },
    };
    repository.saveLesson(context.session);

    const response = await service.respond(context, "one half", {
      responseMode: "dtmf",
    });
    expect(response.evidence.kind).toBe("transfer");
    expect(response.turn.mastery_status).toBe("developing");
    expect(response.activity.keypadChoices).toHaveLength(2);
    repository.close();
  });

  it("resumes the exact unfinished question from another phone identity", async () => {
    const { repository, service } = fixture();
    const learner = service.identifyLearner({
      phoneNumber: "+14155550103",
      learnerName: "Daniel",
    });
    let context = service.beginOrResumeLearner(learner);
    context = (await service.respond(context, "Teach me fractions.")).context;
    const pending = context.session.lastPrompt;
    service.pause(context, "drop");

    const resumed = service.beginOrResumeLearner(learner, "missed_call");
    expect(resumed.resumed).toBe(true);
    expect(resumed.session.lastPrompt).toBe(pending);
    expect(resumed.greeting).toContain(pending);
    expect(
      repository
        .listProductMetrics()
        .filter((event) => event.name === "drop_recovered"),
    ).toHaveLength(1);
    repository.close();
  });

  it("runs unrelated learner topics through the same pack-free engine contract", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new OpenTopicLessonService({
      repository,
      engine: new OfflineOpenTopicEngine(),
      phoneHashSecret: "universal-open-topic-secret",
    });
    const topics = [
      "Help me understand a verb.",
      "Why does the moon appear to follow our car?",
      "Teach me how to prepare for my chemistry exam.",
    ];
    for (const [index, topic] of topics.entries()) {
      const learner = service.identifyLearner({
        phoneNumber: `+1415555020${index}`,
        learnerName: `Learner ${index}`,
      });
      const response = await service.respond(
        service.beginOrResumeLearner(learner),
        topic,
      );
      expect(response.decision.openTopicPlan).toMatchObject({ topic });
      expect(response.decision.learningIntent).toMatchObject({
        learnerWords: topic,
      });
      expect(response.context.session.curriculumPackId).toBe(
        "continuum-open-topic-v1",
      );
      expect(response.activity.kind).toBe("socratic_prompt");
    }
    repository.close();
  });

  it("redacts private contact details before model input, evidence, and memory", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const engine = new OfflineOpenTopicEngine();
    const service = new OpenTopicLessonService({
      repository,
      engine,
      phoneHashSecret: "privacy-open-topic-secret",
    });
    const learner = service.identifyLearner({
      phoneNumber: "+14155550300",
      learnerName: "Private Learner",
    });
    const response = await service.respond(
      service.beginOrResumeLearner(learner),
      "Teach me algebra. Email me at child@example.com and I live at 10 Main Street.",
    );
    const serialized = JSON.stringify({
      turn: response.turn,
      evidence: response.evidence,
      decision: response.decision,
    });
    expect(serialized).not.toContain("child@example.com");
    expect(serialized).not.toContain("10 Main Street");
    expect(serialized).toContain("[email redacted]");
    expect(serialized).toContain("[address redacted]");
    repository.close();
  });

  it("allows consented preferences to be corrected without treating them as evidence", () => {
    const { repository, service } = fixture();
    const learner = service.identifyLearner({
      phoneNumber: "+14155550301",
      learnerName: "Nia",
    });
    const context = service.beginOrResumeLearner(learner);
    expect(() =>
      service.updateEducationProfile(context, {
        consentConfirmed: false,
        preferredExamples: ["football"],
      }),
    ).toThrow(/explicit consent/u);
    service.updateEducationProfile(context, {
      consentConfirmed: true,
      preferredExamples: ["football"],
    });
    const corrected = service.updateEducationProfile(context, {
      consentConfirmed: true,
      preferredExamples: ["music"],
    });
    expect(corrected.preferredExamples).toEqual(["music"]);
    expect(corrected.consentedFields).toContain("preferred_examples");
    expect(repository.listLearningEvidence(learner.id)).toHaveLength(0);
    repository.close();
  });

  it("rejects a model activity that tries to skip the trusted teaching phase", async () => {
    const base = new TestOpenTopicEngine();
    const engine: OpenTopicTeachingEngine = {
      modelRoute: "phase-breaking-engine",
      async teachOpenTopic(request) {
        const result = await base.teachOpenTopic(request);
        return {
          value: {
            ...result.value,
            activityKind: "story",
          },
        };
      },
    };
    const repository = new SqliteLearningRepository(":memory:");
    const service = new OpenTopicLessonService({
      repository,
      engine,
      phoneHashSecret: "phase-gate-secret",
    });
    const learner = service.identifyLearner({
      phoneNumber: "+14155550302",
      learnerName: "Gate Test",
    });
    await expect(
      service.respond(
        service.beginOrResumeLearner(learner),
        "Teach me about shadows.",
      ),
    ).rejects.toThrow(/story during the trusted diagnose phase/u);
    expect(repository.listTurns(repository.listRecentLessons(1)[0]!.id)).toHaveLength(0);
    repository.close();
  });

});
