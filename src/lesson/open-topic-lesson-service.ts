import { randomUUID } from "node:crypto";
import {
  EvidenceResultSchema,
  LearnerEducationProfileSchema,
  LearnerResponseModeSchema,
  LearningActivitySchema,
  LearningEvidenceSchema,
  PedagogyDecisionSchema,
  TeachingFeedbackSchema,
  assertSafeEducationalMotivation,
  masteryMayBeSecure,
  nextReviewAfterDays,
  type LearningActivity,
  type LearningEvidence,
  type PedagogyDecision,
  type TeachingFeedback,
  type LearnerEducationProfile,
} from "../domain/classroom.js";
import { hashPhoneNumber, normalizeLearnerName } from "../domain/identity.js";
import {
  LearnerProfileSchema,
  LessonSessionSchema,
  StoredTeachingTurnSchema,
  type LearnerProfile,
  type LearningRepository,
  type LessonSession,
} from "../domain/learner.js";
import {
  OPEN_TOPIC_NAMESPACE,
  OPEN_TOPIC_PLACEHOLDER,
  OPEN_TOPIC_PROMPT,
  OpenTopicRequestSchema,
  evidenceKindForOpenTopicPhase,
  enforceHumanSupportForKnowledgeState,
  nextOpenTopicPhase,
  openTopicPolicyFailures,
} from "../domain/open-topic.js";
import {
  ProductMetricEventSchema,
  type AccessMode,
} from "../domain/product-metrics.js";
import {
  TeachingTurnSchema,
  type LanguageMode,
  type TeachingTurn,
} from "../domain/teaching.js";
import { StoredModelUsageSchema, type ModelUsage } from "../domain/usage.js";
import { assertVoiceNativeTeachingTurn } from "../domain/voice-output.js";
import type { OpenTopicTeachingEngine } from "../engine/open-topic-engine.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";
import type { HomeworkDraft } from "../messaging/homework-service.js";
import type { z } from "zod";

type LearnerResponseMode = z.infer<typeof LearnerResponseModeSchema>;

export interface OpenTopicLessonContext {
  learner: LearnerProfile;
  session: LessonSession;
  resumed: boolean;
  greeting: string;
}

export interface OpenTopicLessonResponse {
  context: OpenTopicLessonContext;
  turn: TeachingTurn;
  activity: LearningActivity;
  evidence: LearningEvidence;
  decision: PedagogyDecision;
}

export class OpenTopicLessonService {
  readonly #repository: LearningRepository;
  readonly #engine: OpenTopicTeachingEngine;
  readonly #phoneHashSecret: string;
  readonly #clock: () => Date;
  readonly #makeId: () => string;

  constructor(options: {
    repository: LearningRepository;
    engine: OpenTopicTeachingEngine;
    phoneHashSecret: string;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    this.#repository = options.repository;
    this.#engine = options.engine;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
  }

  get modelRoute(): string {
    return this.#engine.modelRoute;
  }

  findLearner(learnerId: string): LearnerProfile | undefined {
    return this.#repository.findLearner(learnerId);
  }

  identifyLearner(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LearnerProfile {
    const normalizedName = normalizeLearnerName(options.learnerName);
    if (!normalizedName) throw new Error("A learner name is required.");
    const phoneHash = hashPhoneNumber(
      options.phoneNumber,
      this.#phoneHashSecret,
    );
    const existing = this.#repository
      .listLearnersForPhone(phoneHash)
      .find((learner) => normalizeLearnerName(learner.name) === normalizedName);
    if (existing) {
      const updated = LearnerProfileSchema.parse({
        ...existing,
        ...(options.preferredLanguage
          ? { preferredLanguage: options.preferredLanguage }
          : {}),
        updatedAt: this.#clock().toISOString(),
      });
      this.#repository.saveLearner(updated);
      return updated;
    }
    const now = this.#clock().toISOString();
    const learner = LearnerProfileSchema.parse({
      id: this.#makeId(),
      phoneHash,
      name: options.learnerName.trim().replace(/\s+/gu, " "),
      preferredLanguage: options.preferredLanguage ?? "und",
      currentConcept: OPEN_TOPIC_PLACEHOLDER,
      lastMastery: "needs_support",
      placementLevel: "unplaced",
      placementScore: 0,
      placementTotal: 0,
      placementEvidence: [],
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveLearner(learner);
    return learner;
  }

  beginOrResumeLearner(
    learner: LearnerProfile,
    accessMode: AccessMode = "unknown",
  ): OpenTopicLessonContext {
    const persisted = this.#repository.findLearner(learner.id);
    if (!persisted) throw new Error(`Unknown learner ${learner.id}.`);
    const now = this.#clock().toISOString();
    const resumable = this.#repository.findResumableLesson(
      learner.id,
      OPEN_TOPIC_NAMESPACE,
    );
    if (resumable) {
      const session = LessonSessionSchema.parse({
        ...resumable,
        status: "active",
        accessMode,
        updatedAt: now,
      });
      this.#repository.saveLesson(session);
      this.#recordRecoveryIfNeeded(session, persisted, now);
      return {
        learner: persisted,
        session,
        resumed: true,
        greeting: `Welcome back, ${persisted.name}. We will continue where you stopped. ${session.lastPrompt}`,
      };
    }
    const session = LessonSessionSchema.parse({
      id: this.#makeId(),
      learnerId: persisted.id,
      curriculumPackId: OPEN_TOPIC_NAMESPACE,
      concept: OPEN_TOPIC_PLACEHOLDER,
      status: "active",
      turnCount: 0,
      lastPrompt: OPEN_TOPIC_PROMPT,
      lastDiagnosis: "No learning evidence yet.",
      lastStrategy: "ask_reasoning",
      masteryStatus: "needs_support",
      masteryEvidence: "No learning evidence yet.",
      placementLevel: "unplaced",
      placementScore: 0,
      placementTotal: 0,
      placementEvidence: [],
      anchorObject: null,
      durationMinutes: 5,
      accessMode,
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveLesson(session);
    return {
      learner: persisted,
      session,
      resumed: false,
      greeting: OPEN_TOPIC_PROMPT,
    };
  }

  async respond(
    context: OpenTopicLessonContext,
    learnerInput: string,
    options: { responseMode?: LearnerResponseMode } = {},
  ): Promise<OpenTopicLessonResponse> {
    if (context.session.status !== "active") {
      throw new Error("An open-topic turn requires an active lesson.");
    }
    const responseMode = options.responseMode ?? "speech";
    const previousTurns = this.#repository.listTurns(context.session.id);
    const latestFeedback =
      this.#repository
        .listTeachingFeedback(context.learner.id, 20)
        .find((feedback) => feedback.sessionId === context.session.id) ?? null;
    const hintCount = previousTurns.filter((entry) =>
      ["smaller_step", "hint_ladder"].includes(entry.turn.next_strategy),
    ).length;
    const phase = nextOpenTopicPhase({
      turnCount: context.session.turnCount,
      previousStrategy: context.session.lastStrategy,
      previousMastery: context.session.masteryStatus,
      latestFeedback,
    });
    const profile = this.#repository.findEducationProfile(context.learner.id);
    const consentedPreferences = profile
      ? {
          preferredExamples: profile.consentedFields.includes("preferred_examples")
            ? profile.preferredExamples
            : [],
          learningGoals: profile.consentedFields.includes("learning_goals")
            ? profile.learningGoals
            : [],
          preferredActivities: profile.consentedFields.includes(
            "preferred_activities",
          )
            ? profile.preferredActivities
            : [],
          preferredPace: profile.consentedFields.includes("preferred_pace")
            ? profile.preferredPace
            : null,
        }
      : null;
    const redactedInput = redactPotentialPii(learnerInput);
    const request = OpenTopicRequestSchema.parse({
      learnerId: context.learner.id,
      learnerInput: redactedInput,
      requestedLanguageMode: context.learner.preferredLanguage,
      phase,
      currentTopic:
        context.session.concept === OPEN_TOPIC_PLACEHOLDER
          ? null
          : context.session.concept,
      previousPrompt: context.session.lastPrompt,
      previousDiagnosis: context.session.lastDiagnosis,
      previousStrategy: context.session.lastStrategy,
      previousMastery: context.session.masteryStatus,
      previousTurns: previousTurns.slice(-8).map((entry) => ({
        learnerInput: entry.turn.learner_answer,
        diagnosis: entry.turn.diagnosis,
        strategy: entry.turn.next_strategy,
        masteryStatus: entry.turn.mastery_status,
        masteryEvidence: entry.turn.mastery_evidence,
        nextQuestion: entry.turn.next_question,
      })),
      responseMode,
      hintCount,
      latestFeedback,
      consentedPreferences,
    });
    const generated = await this.#engine.teachOpenTopic(request);
    const modelTurn = generated.value;
    const policyFailures = openTopicPolicyFailures(request, modelTurn);
    if (policyFailures.length > 0) {
      throw new Error(
        `Teaching policy violation: ${policyFailures.join("; ")}.`,
      );
    }

    const evidenceKind = evidenceKindForOpenTopicPhase(phase);
    const evidenceResult =
      phase === "diagnose"
        ? EvidenceResultSchema.parse("unclear")
        : modelTurn.evidenceResult;
    const independent =
      responseMode !== "dtmf" &&
      hintCount === 0 &&
      (evidenceKind === "transfer" || evidenceKind === "retention");
    const secureAllowed = masteryMayBeSecure({
      kind: evidenceKind,
      result: evidenceResult,
      independent,
      responseMode,
    });
    const mastery =
      modelTurn.masteryStatus === "secure" && !secureAllowed
        ? "developing"
        : modelTurn.masteryStatus;
    const shouldEnd = phase === "recap" && modelTurn.shouldEndSession;
    const humanSupport = enforceHumanSupportForKnowledgeState(
      modelTurn.topicPlan.knowledgeState,
      modelTurn.humanSupport,
    );
    const turn = TeachingTurnSchema.parse({
      learner_id: context.learner.id,
      concept: modelTurn.topicPlan.topic,
      learner_answer: redactedInput,
      anchor_object: null,
      diagnosis: modelTurn.diagnosis,
      reasoning_trace: [
        {
          source: "learner_stated",
          claim: redactedInput,
          status: "supported",
        },
        {
          source: "tutor_inference",
          claim: modelTurn.diagnosis,
          status:
            evidenceResult === "unclear" ? "unclear" : "supported",
        },
      ],
      language_mode: modelTurn.languageMode,
      next_strategy: phase === "recap" ? "recap" : modelTurn.strategy,
      mastery_status: mastery,
      mastery_evidence: modelTurn.masteryEvidence,
      next_question: modelTurn.nextQuestion,
      spoken_response: modelTurn.spokenResponse,
      should_end_session: shouldEnd,
    });
    assertVoiceNativeTeachingTurn(turn);
    assertSafeEducationalMotivation(turn.spoken_response);
    this.#assertKeypadChoicesSpoken(turn.spoken_response, modelTurn.keypadChoices);

    const now = this.#clock().toISOString();
    const activity = LearningActivitySchema.parse({
      id: this.#makeId(),
      kind: modelTurn.activityKind,
      objective: modelTurn.topicPlan.objective,
      voiceScript: turn.spoken_response,
      expectedResponse: turn.should_end_session
        ? "none"
        : modelTurn.keypadChoices.length > 0
          ? "choice"
          : modelTurn.activityKind === "reflection"
            ? "reflection"
            : "open_speech",
      reviewedQuestionId: null,
      keypadChoices: modelTurn.keypadChoices.map((choice) => ({
        ...choice,
        reviewedAnswerId: null,
      })),
      smsText: modelTurn.smsFollowUp,
      estimatedSeconds: turn.should_end_session ? 15 : 45,
      canCreateMasteryEvidence: [
        "quiz",
        "teach_back",
        "retrieval",
        "transfer",
      ].includes(modelTurn.activityKind),
    });
    const evidence = LearningEvidenceSchema.parse({
      id: this.#makeId(),
      learnerId: context.learner.id,
      sessionId: context.session.id,
      curriculumPackId: OPEN_TOPIC_NAMESPACE,
      concept: modelTurn.topicPlan.topic,
      activityId: activity.id,
      kind: evidenceKind,
      result: evidenceResult,
      independent,
      responseMode,
      reasoningEvidence: modelTurn.masteryEvidence,
      strategy: context.session.lastStrategy,
      hintCount,
      createdAt: now,
    });
    const decision = PedagogyDecisionSchema.parse({
      learnerId: context.learner.id,
      sessionId: context.session.id,
      curriculumPackId: OPEN_TOPIC_NAMESPACE,
      concept: modelTurn.topicPlan.topic,
      activity,
      diagnosis: modelTurn.diagnosis,
      strategy: turn.next_strategy,
      strategyReason:
        latestFeedback?.helpfulness === "not_helpful"
          ? `The learner marked ${latestFeedback.strategy} not helpful; a different method was required. ${modelTurn.strategyReason}`
          : modelTurn.strategyReason,
      strategyChanged: context.session.lastStrategy !== turn.next_strategy,
      evidenceKind,
      evidenceResult,
      independentEvidence: independent,
      responseMode,
      humanSupport,
      reviewAfterDays: nextReviewAfterDays({
        result: evidenceResult,
        masteryStatus: mastery,
      }),
      openTopicPlan: modelTurn.topicPlan,
      learningIntent: modelTurn.learningIntent,
      knowledgeState: modelTurn.topicPlan.knowledgeState,
      expectedChoiceKey: modelTurn.expectedChoiceKey,
      smsFollowUp: modelTurn.smsFollowUp,
      createdAt: now,
    });
    const session = LessonSessionSchema.parse({
      ...context.session,
      concept: modelTurn.topicPlan.topic,
      status: turn.should_end_session ? "completed" : "active",
      turnCount: context.session.turnCount + 1,
      lastPrompt: turn.next_question,
      lastDiagnosis: turn.diagnosis,
      lastStrategy: turn.next_strategy,
      masteryStatus: mastery,
      masteryEvidence: turn.mastery_evidence,
      updatedAt: now,
    });
    const learner = LearnerProfileSchema.parse({
      ...context.learner,
      preferredLanguage: turn.language_mode,
      currentConcept: modelTurn.topicPlan.topic,
      lastMastery: mastery,
      updatedAt: now,
    });

    // Persist the exact next question and activity before the caller hears it.
    this.#repository.appendTurn(
      StoredTeachingTurnSchema.parse({
        id: this.#makeId(),
        sessionId: session.id,
        sequence: session.turnCount,
        turn,
        modelRoute: this.#engine.modelRoute,
        createdAt: now,
      }),
    );
    this.#repository.appendLearningEvidence(evidence);
    this.#repository.appendPedagogyDecision(decision);
    this.#repository.saveLesson(session);
    this.#repository.saveLearner(learner);
    if (responseMode === "dtmf") {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "keypad_fallback_completed",
          learnerId: learner.id,
          sessionId: session.id,
          channel: "dtmf",
          accessMode: session.accessMode,
          numericValue: null,
          synthetic: false,
          createdAt: now,
        }),
      );
    }
    if (turn.should_end_session) {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "lesson_completed",
          learnerId: learner.id,
          sessionId: session.id,
          channel: "phone",
          accessMode: session.accessMode,
          numericValue: session.turnCount,
          synthetic: false,
          createdAt: now,
        }),
      );
    }
    if (generated.usage) {
      this.recordModelUsage(
        { ...context, learner, session },
        generated.usage,
      );
    }
    return {
      context: { ...context, learner, session },
      turn,
      activity,
      evidence,
      decision,
    };
  }

  recordTeachingFeedback(
    context: OpenTopicLessonContext,
    options: {
      helpfulness: TeachingFeedback["helpfulness"];
      pace?: TeachingFeedback["pace"];
      preferredActivity?: TeachingFeedback["preferredActivity"];
      objectiveResult?: TeachingFeedback["objectiveResult"];
      responseMode?: LearnerResponseMode;
    },
  ): TeachingFeedback {
    const feedback = TeachingFeedbackSchema.parse({
      id: this.#makeId(),
      learnerId: context.learner.id,
      sessionId: context.session.id,
      subject: context.session.concept,
      strategy: context.session.lastStrategy,
      helpfulness: options.helpfulness,
      pace: options.pace ?? null,
      preferredActivity: options.preferredActivity ?? null,
      objectiveResult: options.objectiveResult ?? "unclear",
      responseMode: options.responseMode ?? "speech",
      createdAt: this.#clock().toISOString(),
    });
    this.#repository.appendTeachingFeedback(feedback);
    return feedback;
  }

  recordKeypadFallbackRequested(context: OpenTopicLessonContext): void {
    this.#recordMetric(context, "keypad_fallback_requested", "dtmf");
  }

  recordUnclearAudioRecovery(
    context: OpenTopicLessonContext,
    outcome: "requested" | "recovered",
  ): void {
    this.#recordMetric(
      context,
      outcome === "requested"
        ? "unclear_audio_recovery_requested"
        : "unclear_audio_recovered",
      "phone",
    );
  }

  async requestHint(
    context: OpenTopicLessonContext,
  ): Promise<OpenTopicLessonResponse> {
    return this.respond(context, "[The learner explicitly requested one small hint.]", {
      responseMode: "dtmf",
    });
  }

  pause(
    context: OpenTopicLessonContext,
    reason: "manual" | "drop" = "manual",
  ): OpenTopicLessonContext {
    if (context.session.status === "completed") return context;
    const now = this.#clock().toISOString();
    const session = LessonSessionSchema.parse({
      ...context.session,
      status: "paused",
      updatedAt: now,
    });
    this.#repository.saveLesson(session);
    if (reason === "drop") {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "drop_paused",
          learnerId: context.learner.id,
          sessionId: session.id,
          channel: "phone",
          accessMode: session.accessMode,
          numericValue: session.turnCount + 1,
          synthetic: false,
          createdAt: now,
        }),
      );
    }
    return { ...context, session };
  }

  recordModelUsage(
    context: OpenTopicLessonContext,
    usage: ModelUsage,
  ): void {
    this.#repository.appendUsage(
      StoredModelUsageSchema.parse({
        ...usage,
        id: this.#makeId(),
        sessionId: context.session.id,
        createdAt: this.#clock().toISOString(),
      }),
    );
  }

  latestActivity(
    context: OpenTopicLessonContext,
  ): LearningActivity | undefined {
    return this.#repository.listPedagogyDecisions(context.session.id).at(-1)
      ?.activity;
  }

  homeworkDraft(
    context: OpenTopicLessonContext,
  ): HomeworkDraft | undefined {
    const decision = this.#repository
      .listPedagogyDecisions(context.session.id)
      .slice()
      .reverse()
      .find(
        (candidate) =>
          candidate.expectedChoiceKey &&
          candidate.activity.keypadChoices.length >= 2 &&
          candidate.smsFollowUp,
      );
    if (!decision?.expectedChoiceKey || !decision.smsFollowUp) return undefined;
    return {
      curriculumPackId: OPEN_TOPIC_NAMESPACE,
      concept: context.session.concept,
      reviewedQuestionId: decision.activity.id,
      prompt: decision.smsFollowUp.slice(0, 100),
      choices: decision.activity.keypadChoices.map((choice) => ({
        key: choice.key,
        label: choice.label,
      })),
      correctKey: decision.expectedChoiceKey,
    };
  }

  updateEducationProfile(
    context: OpenTopicLessonContext,
    options: {
      consentConfirmed: boolean;
      preferredExamples?: string[];
      learningGoals?: string[];
      preferredActivities?: LearnerEducationProfile["preferredActivities"];
      preferredPace?: LearnerEducationProfile["preferredPace"];
    },
  ): LearnerEducationProfile {
    if (!options.consentConfirmed) {
      throw new Error("Learning preferences require explicit consent.");
    }
    const hasApprovedPreference =
      options.preferredExamples !== undefined ||
      options.learningGoals !== undefined ||
      options.preferredActivities !== undefined ||
      options.preferredPace !== undefined;
    if (!hasApprovedPreference) {
      throw new Error("At least one approved learning preference is required.");
    }
    const now = this.#clock().toISOString();
    const existing =
      this.#repository.findEducationProfile(context.learner.id) ??
      {
        learnerId: context.learner.id,
        ageBand: "unknown" as const,
        reportedGrade: null,
        interests: [],
        aspirations: [],
        curiosityTopics: [],
        preferredExamples: [],
        learningGoals: [],
        preferredActivities: [],
        preferredPace: null,
        consentedFields: [],
        updatedAt: now,
      };
    const consented = new Set(existing.consentedFields);
    if (options.preferredExamples) consented.add("preferred_examples");
    if (options.learningGoals) consented.add("learning_goals");
    if (options.preferredActivities) consented.add("preferred_activities");
    if (options.preferredPace !== undefined) consented.add("preferred_pace");
    const profile = LearnerEducationProfileSchema.parse({
      ...existing,
      ...(options.preferredExamples
        ? { preferredExamples: options.preferredExamples }
        : {}),
      ...(options.learningGoals ? { learningGoals: options.learningGoals } : {}),
      ...(options.preferredActivities
        ? { preferredActivities: options.preferredActivities }
        : {}),
      ...(options.preferredPace !== undefined
        ? { preferredPace: options.preferredPace }
        : {}),
      consentedFields: [...consented],
      updatedAt: now,
    });
    this.#repository.saveEducationProfile(profile);
    return profile;
  }

  #assertKeypadChoicesSpoken(
    spokenResponse: string,
    choices: LearningActivity["keypadChoices"],
  ): void {
    const normalized = spokenResponse.toLocaleLowerCase();
    for (const choice of choices) {
      if (!normalized.includes(choice.label.toLocaleLowerCase())) {
        throw new Error(
          `Keypad choice ${choice.key} was not spoken before input became valid.`,
        );
      }
    }
  }

  #recordRecoveryIfNeeded(
    session: LessonSession,
    learner: LearnerProfile,
    now: string,
  ): void {
    const events = this.#repository
      .listProductMetrics()
      .filter((event) => event.sessionId === session.id);
    const paused = events.filter((event) => event.name === "drop_paused").length;
    const recovered = events.filter(
      (event) => event.name === "drop_recovered",
    ).length;
    if (paused <= recovered) return;
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name: "drop_recovered",
        learnerId: learner.id,
        sessionId: session.id,
        channel: "phone",
        accessMode: session.accessMode,
        numericValue: session.turnCount + 1,
        synthetic: false,
        createdAt: now,
      }),
    );
  }

  #recordMetric(
    context: OpenTopicLessonContext,
    name:
      | "keypad_fallback_requested"
      | "unclear_audio_recovery_requested"
      | "unclear_audio_recovered",
    channel: "phone" | "dtmf",
  ): void {
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name,
        learnerId: context.learner.id,
        sessionId: context.session.id,
        channel,
        accessMode: context.session.accessMode,
        numericValue: null,
        synthetic: false,
        createdAt: this.#clock().toISOString(),
      }),
    );
  }
}
