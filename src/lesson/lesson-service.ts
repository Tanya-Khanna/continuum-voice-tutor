import { randomUUID } from "node:crypto";
import type { CurriculumPack } from "../curriculum/schema.js";
import type { LearningHistoryResponse } from "../domain/history.js";
import { hashPhoneNumber, normalizeLearnerName } from "../domain/identity.js";
import {
  LearnerProfileSchema,
  LessonSessionSchema,
  StoredTeachingTurnSchema,
  type LearnerProfile,
  type LearningRepository,
  type LessonSession,
} from "../domain/learner.js";
import { StoredModelUsageSchema, type ModelUsage } from "../domain/usage.js";
import {
  SandboxTurnSchema,
  StoredSandboxTurnSchema,
  type SandboxTurn,
} from "../domain/sandbox.js";
import {
  TeachingTurnSchema,
  type LanguageMode,
  type LessonPhase,
  type TeachingTurn,
} from "../domain/teaching.js";
import { assertVoiceNativeTeachingTurn } from "../domain/voice-output.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";
import {
  placementResultFromEvaluation,
  type PlacementAnswer,
  type PlacementResult,
} from "../engine/placement-diagnostic.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";
import {
  EvidenceResultSchema,
  HumanSupportDecisionSchema,
  LearningActivitySchema,
  LearningEvidenceSchema,
  LearnerResponseModeSchema,
  LessonDurationMinutesSchema,
  PedagogyDecisionSchema,
  TeachingFeedbackSchema,
  activityKindForStrategy,
  assertSafeEducationalMotivation,
  masteryMayBeSecure,
  nextReviewAfterDays,
  humanSupportDecisionFor,
  type LearningActivity,
  type LearningEvidence,
  type PedagogyDecision,
  type TeachingFeedback,
  CuriosityTrailSchema,
  type CuriosityTrail,
  LearnerEducationProfileSchema,
  type LearnerEducationProfile,
} from "../domain/classroom.js";
import type { z } from "zod";
import {
  ProductMetricEventSchema,
  type AccessMode,
} from "../domain/product-metrics.js";
import type { HomeworkDraft } from "../messaging/homework-service.js";

export interface LessonContext {
  learner: LearnerProfile;
  session: LessonSession;
  resumed: boolean;
  greeting: string;
}

export interface LessonResponse {
  context: LessonContext;
  turn: TeachingTurn;
  activity: LearningActivity;
  evidence: LearningEvidence;
  decision: PedagogyDecision;
}

export type LearnerResponseMode = z.infer<typeof LearnerResponseModeSchema>;
export type LessonDurationMinutes = z.infer<typeof LessonDurationMinutesSchema>;

export type CallLearningMode = "guided" | "curious_sandbox";

function replaceFinalSpokenQuestion(options: {
  spokenResponse: string;
  previousQuestion: string;
  reviewedQuestion: string;
}): string {
  const spoken = options.spokenResponse.trim();
  const previous = options.previousQuestion.trim();
  let lead = spoken;
  if (previous && spoken.endsWith(previous)) {
    lead = spoken.slice(0, -previous.length).trim();
  } else {
    lead = spoken.replace(/[^.!?]*\?\s*$/u, "").trim();
  }
  if (!lead) return options.reviewedQuestion;
  const punctuatedLead = /[.!?]$/u.test(lead) ? lead : `${lead}.`;
  return `${punctuatedLead} ${options.reviewedQuestion}`;
}

export function targetTurnsForDuration(
  baseTargetTurns: number,
  durationMinutes: LessonDurationMinutes,
): number {
  if (durationMinutes === 3) {
    return Math.max(3, Math.round(baseTargetTurns * 0.6));
  }
  if (durationMinutes === 10) {
    return Math.min(20, Math.max(baseTargetTurns + 1, baseTargetTurns * 2));
  }
  return baseTargetTurns;
}

export interface LessonServiceOptions {
  repository: LearningRepository;
  engine: TeachingEngine;
  clock?: () => Date;
  makeId?: () => string;
  phoneHashSecret: string;
  curriculumPack: CurriculumPack;
  acceptLegacySessions?: boolean;
}

export class LessonService {
  readonly #repository: LearningRepository;
  readonly #engine: TeachingEngine;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #phoneHashSecret: string;
  readonly #curriculumPack: CurriculumPack;
  readonly #acceptLegacySessions: boolean;
  readonly #startingConcept: CurriculumPack["concepts"][number];

  constructor(options: LessonServiceOptions) {
    this.#repository = options.repository;
    this.#engine = options.engine;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#curriculumPack = options.curriculumPack;
    this.#acceptLegacySessions = options.acceptLegacySessions ?? true;
    const startingConcept = options.curriculumPack.concepts[0];
    if (!startingConcept) throw new Error("The curriculum pack has no concepts.");
    this.#startingConcept = startingConcept;
  }

  beginOrResume(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LessonContext {
    return this.beginOrResumeLearner(this.identifyLearner(options));
  }

  availableSubjects(): string[] {
    return [this.#curriculumPack.deployment.subject];
  }

  findLearner(learnerId: string): LearnerProfile | undefined {
    return this.#repository.findLearner(learnerId);
  }

  subjectForContext(_context: LessonContext): string {
    return this.#curriculumPack.deployment.subject;
  }

  identifyLearner(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LearnerProfile {
    const now = this.#clock().toISOString();
    const phoneHash = hashPhoneNumber(
      options.phoneNumber,
      this.#phoneHashSecret,
    );
    const normalizedName = normalizeLearnerName(options.learnerName);
    if (!normalizedName) throw new Error("A learner name is required.");

    const existingLearner = this.#repository
      .listLearnersForPhone(phoneHash)
      .find((profile) => normalizeLearnerName(profile.name) === normalizedName);

    const learner =
      existingLearner ??
      LearnerProfileSchema.parse({
        id: this.#makeId(),
        phoneHash,
        name: options.learnerName.trim().replace(/\s+/g, " "),
        preferredLanguage: options.preferredLanguage ?? "und",
        currentConcept: this.#startingConcept.id,
        lastMastery: "needs_support",
        placementLevel: "unplaced",
        placementScore: 0,
        placementTotal: 0,
        placementEvidence: [],
        createdAt: now,
        updatedAt: now,
      });

    if (!existingLearner) this.#repository.saveLearner(learner);
    return learner;
  }

  beginOrResumeSubject(
    learner: LearnerProfile,
    subject?: string,
    accessMode: AccessMode = "unknown",
  ): LessonContext {
    if (
      subject &&
      subject.trim().toLocaleLowerCase("en-US") !==
        this.#curriculumPack.deployment.subject
          .trim()
          .toLocaleLowerCase("en-US")
    ) {
      throw new Error(
        `Unknown guided subject ${subject}. Available subjects: ${this.#curriculumPack.deployment.subject}.`,
      );
    }
    return this.beginOrResumeLearner(learner, accessMode);
  }

  beginOrResumeLearner(
    learner: LearnerProfile,
    accessMode: AccessMode = "unknown",
  ): LessonContext {
    const persistedLearner = this.#repository.findLearner(learner.id);
    if (!persistedLearner) {
      throw new Error(`Learner ${learner.id} is not present in the repository.`);
    }
    const nowDate = this.#clock();
    const now = nowDate.toISOString();

    const existingLesson = this.#repository.findResumableLesson(
      persistedLearner.id,
      this.#curriculumPack.id,
      this.#acceptLegacySessions,
    );
    if (existingLesson) {
      const concept = this.#concept(existingLesson.concept);
      const elapsedMinutes =
        (nowDate.getTime() - new Date(existingLesson.updatedAt).getTime()) /
        60_000;
      const isRecentDrop =
        elapsedMinutes <=
        this.#curriculumPack.lessonPolicy.recentDropRecoveryMinutes;
      const prompt = isRecentDrop
        ? existingLesson.lastPrompt
        : this.#retrievalQuestion(concept, existingLesson.turnCount);
      const resumedLesson = LessonSessionSchema.parse({
        ...existingLesson,
        curriculumPackId: this.#curriculumPack.id,
        accessMode,
        status: "active",
        lastPrompt: prompt,
        updatedAt: now,
      });
      this.#repository.saveLesson(resumedLesson);
      if (isRecentDrop && existingLesson.status === "paused") {
        const sessionMetrics = this.#repository
          .listProductMetrics()
          .filter((event) => event.sessionId === existingLesson.id);
        const pausedDrops = sessionMetrics.filter(
          (event) => event.name === "drop_paused",
        ).length;
        const recoveredDrops = sessionMetrics.filter(
          (event) => event.name === "drop_recovered",
        ).length;
        if (pausedDrops > recoveredDrops) {
          this.#repository.appendProductMetric(
            ProductMetricEventSchema.parse({
              id: this.#makeId(),
              name: "drop_recovered",
              learnerId: persistedLearner.id,
              sessionId: resumedLesson.id,
              channel: "phone",
              accessMode: resumedLesson.accessMode,
              numericValue: resumedLesson.turnCount + 1,
              synthetic: false,
              createdAt: now,
            }),
          );
        }
      }
      return {
        learner: persistedLearner,
        session: resumedLesson,
        resumed: true,
        greeting: `${isRecentDrop ? this.#curriculumPack.lessonPolicy.recentResumeLead : this.#curriculumPack.lessonPolicy.returnRetrievalLead} ${prompt}`,
      };
    }

    const latestLesson = this.#repository.findLatestLesson(
      persistedLearner.id,
      this.#curriculumPack.id,
      this.#acceptLegacySessions,
    );
    const concept = latestLesson
      ? this.#concept(latestLesson.concept)
      : this.#startingConcept;
    const firstPrompt = latestLesson
      ? this.#retrievalQuestion(concept, latestLesson.turnCount)
      : concept.teachingScaffold.entryQuestion;

    const session = LessonSessionSchema.parse({
      id: this.#makeId(),
      learnerId: persistedLearner.id,
      curriculumPackId: this.#curriculumPack.id,
      concept: concept.id,
      status: "active",
      turnCount: 0,
      lastPrompt: firstPrompt,
      lastDiagnosis: "No evidence yet.",
      lastStrategy: "ask_reasoning",
      masteryStatus: latestLesson?.masteryStatus ?? "needs_support",
      masteryEvidence: latestLesson?.masteryEvidence ?? "No evidence yet.",
      placementLevel: latestLesson?.placementLevel ?? "unplaced",
      placementScore: latestLesson?.placementScore ?? 0,
      placementTotal: latestLesson?.placementTotal ?? 0,
      placementEvidence: latestLesson?.placementEvidence ?? [],
      accessMode,
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveLesson(session);

    return {
      learner: persistedLearner,
      session,
      resumed: Boolean(latestLesson),
      greeting: latestLesson
        ? `${this.#curriculumPack.lessonPolicy.returnRetrievalLead} ${firstPrompt}`
        : `Hello, ${persistedLearner.name}. ${firstPrompt}`,
    };
  }

  async respond(
    context: LessonContext,
    learnerAnswer: string,
    options: { responseMode?: LearnerResponseMode } = {},
  ): Promise<LessonResponse> {
    const responseMode = LearnerResponseModeSchema.parse(
      options.responseMode ?? "speech",
    );
    const sequence = context.session.turnCount + 1;
    const targetTurns = targetTurnsForDuration(
      this.#curriculumPack.lessonPolicy.targetTurns,
      context.session.durationMinutes,
    );
    const phase: LessonPhase =
      sequence >= targetTurns
        ? "recap"
        : sequence === targetTurns - 1
          ? "reflect"
          : sequence === targetTurns - 2
            ? "check"
            : "explore";
    const priorReasoningEvidenceCount = this.#repository
      .listTurns(context.session.id)
      .filter((entry) => entry.turn.mastery_status !== "needs_support").length;
    const previousTurns = this.#repository.listTurns(context.session.id);
    const previousStrategies = previousTurns.map(
      (entry) => entry.turn.next_strategy,
    );
    const latestFeedback = this.#repository
      .listTeachingFeedback(context.learner.id, 20)
      .find((feedback) => feedback.sessionId === context.session.id) ?? null;
    const hintCount = previousStrategies.filter(
      (strategy) => strategy === "smaller_step" || strategy === "hint_ladder",
    ).length;
    let consecutiveSafetyRedirects = 0;
    for (const entry of [...previousTurns].reverse()) {
      if (entry.turn.next_strategy !== "safety_redirect") break;
      consecutiveSafetyRedirects += 1;
    }
    const redactedLearnerAnswer = redactPotentialPii(learnerAnswer);
    const generated = await this.#engine.teach({
      learnerId: context.learner.id,
      concept: context.session.concept,
      learnerAnswer: redactedLearnerAnswer,
      requestedLanguageMode: context.learner.preferredLanguage,
      lessonState: {
        turnNumber: sequence,
        targetTurns,
        phase,
        previousPrompt: context.session.lastPrompt,
        previousDiagnosis: context.session.lastDiagnosis,
        priorReasoningEvidenceCount,
        consecutiveSafetyRedirects,
        anchorObject: context.session.anchorObject,
        placementLevel: context.session.placementLevel,
        responseMode,
        previousStrategies,
        latestFeedback,
        hintCount,
        educationProfile:
          this.#repository.findEducationProfile(context.learner.id) ?? null,
      },
    });
    const generatedTurn = generated.value;
    if (
      latestFeedback?.helpfulness === "not_helpful" &&
      generatedTurn.next_strategy === latestFeedback.strategy &&
      generatedTurn.next_strategy !== "safety_redirect" &&
      phase !== "recap"
    ) {
      throw new Error(
        `Teaching policy violation: strategy ${generatedTurn.next_strategy} repeated after the learner marked it not helpful.`,
      );
    }
    const concept = this.#concept(context.session.concept);
    const reviewedKeypadQuestion =
      phase === "check"
        ? concept.keypadQuestions[sequence % concept.keypadQuestions.length]
        : undefined;
    const renderedSpokenResponse = reviewedKeypadQuestion
      ? replaceFinalSpokenQuestion({
          spokenResponse: generatedTurn.spoken_response,
          previousQuestion: generatedTurn.next_question,
          reviewedQuestion: reviewedKeypadQuestion.prompt,
        })
      : generatedTurn.spoken_response;
    const anchorObject = generatedTurn.anchor_object;
    const proposedAnchor = anchorObject
      ? concept.anchorActivities.find(
          (activity) => activity.objectName === anchorObject,
        )
      : undefined;
    const normalizedAnswer = redactedLearnerAnswer.toLocaleLowerCase();
    const learnerConfirmedAnchor = proposedAnchor
      ? [proposedAnchor.objectName, ...proposedAnchor.learnerSignals].some(
          (signal) =>
            normalizedAnswer.includes(signal.toLocaleLowerCase()),
        )
      : false;
    const acceptedAnchorObject = learnerConfirmedAnchor
      ? proposedAnchor!.objectName
      : context.session.anchorObject;
    const shouldEndForSafety =
      generatedTurn.next_strategy === "safety_redirect" &&
      consecutiveSafetyRedirects + 1 >=
        this.#curriculumPack.safetyPolicy.maxConsecutiveRedirects;
    const evidenceKind =
      context.session.lastStrategy === "reflection"
        ? "reflection"
        : context.session.lastStrategy === "retrieval_practice"
        ? "retention"
        : context.session.lastStrategy === "teach_back"
          ? "teach_back"
          : context.session.lastStrategy === "transfer"
            ? "transfer"
            : sequence === 1
              ? "diagnostic"
              : "guided_practice";
    const evidenceResult = EvidenceResultSchema.parse(
      generatedTurn.next_strategy === "safety_redirect" ||
        generatedTurn.next_strategy === "uncertainty"
        ? "unclear"
        : generatedTurn.mastery_status === "secure"
          ? "correct"
          : generatedTurn.mastery_status === "developing"
            ? "partial"
            : "incorrect",
    );
    const independentEvidence =
      responseMode !== "dtmf" &&
      hintCount === 0 &&
      (evidenceKind === "transfer" || evidenceKind === "retention");
    const secureAllowed = masteryMayBeSecure({
      kind: evidenceKind,
      result: evidenceResult,
      independent: independentEvidence,
      responseMode,
    });
    const turn = TeachingTurnSchema.parse({
      ...generatedTurn,
      learner_answer: redactedLearnerAnswer,
      spoken_response: renderedSpokenResponse,
      next_question:
        reviewedKeypadQuestion?.prompt ?? generatedTurn.next_question,
      anchor_object: acceptedAnchorObject,
      mastery_status:
        phase === "recap"
          ? context.session.masteryStatus
          : generatedTurn.mastery_status === "secure" &&
              (priorReasoningEvidenceCount < 1 || !secureAllowed)
            ? "developing"
            : generatedTurn.mastery_status,
      next_strategy:
        phase === "recap"
          ? "recap"
          : phase === "check"
            ? "transfer"
            : generatedTurn.next_strategy,
      should_end_session: phase === "recap" || shouldEndForSafety,
    });
    assertVoiceNativeTeachingTurn(turn);
    assertSafeEducationalMotivation(turn.spoken_response);
    const now = this.#clock().toISOString();
    const activityKind = activityKindForStrategy({
      strategy: turn.next_strategy,
      phase,
      hasMisconception: evidenceResult === "incorrect",
    });
    const activity = LearningActivitySchema.parse({
      id: this.#makeId(),
      kind: activityKind,
      objective: concept.learningObjective,
      voiceScript: turn.spoken_response,
      expectedResponse: turn.should_end_session
        ? "none"
        : reviewedKeypadQuestion
          ? "choice"
        : activityKind === "reflection"
          ? "reflection"
          : "open_speech",
      reviewedQuestionId: reviewedKeypadQuestion?.id ?? null,
      keypadChoices:
        reviewedKeypadQuestion?.choices.map((choice, index) => ({
          key: String(index + 1),
          label: choice.label,
          reviewedAnswerId: choice.id,
        })) ?? [],
      smsText: reviewedKeypadQuestion?.featurePhoneSms ?? null,
      estimatedSeconds: turn.should_end_session ? 15 : 45,
      canCreateMasteryEvidence: [
        "quiz",
        "flashcard",
        "teach_back",
        "retrieval",
        "transfer",
      ].includes(activityKind),
    });
    const evidence = LearningEvidenceSchema.parse({
      id: this.#makeId(),
      learnerId: context.learner.id,
      sessionId: context.session.id,
      curriculumPackId: this.#curriculumPack.id,
      concept: context.session.concept,
      activityId: activity.id,
      kind: evidenceKind,
      result: evidenceResult,
      independent: independentEvidence,
      responseMode,
      reasoningEvidence: turn.mastery_evidence,
      strategy: context.session.lastStrategy,
      hintCount,
      createdAt: now,
    });
    const distinctFailedStrategies = new Set(
      previousTurns
        .filter((entry) => entry.turn.mastery_status === "needs_support")
        .map((entry) => entry.turn.next_strategy),
    );
    const humanSupport = HumanSupportDecisionSchema.parse(
      humanSupportDecisionFor({
        immediateSafetyConcern:
          turn.next_strategy === "safety_redirect" &&
          /immediate danger|abuse|self-harm|suicid|emergency/iu.test(
            turn.diagnosis,
          ),
        highStakesQuestion:
          turn.next_strategy === "safety_redirect" &&
          /medical|legal|crisis|high.stakes/iu.test(turn.diagnosis),
        accommodationRequested: /accommodation|accessibility/iu.test(
          turn.diagnosis,
        ),
        curriculumReviewNeeded:
          turn.next_strategy === "uncertainty" &&
          /curriculum|source|verification/iu.test(turn.diagnosis),
        distinctFailedStrategies:
          turn.mastery_status === "needs_support"
            ? distinctFailedStrategies.size
            : 0,
      }),
    );
    const decision = PedagogyDecisionSchema.parse({
      learnerId: context.learner.id,
      sessionId: context.session.id,
      curriculumPackId: this.#curriculumPack.id,
      concept: context.session.concept,
      activity,
      diagnosis: turn.diagnosis,
      strategy: turn.next_strategy,
      strategyReason:
        latestFeedback?.helpfulness === "not_helpful"
          ? `The learner marked ${latestFeedback.strategy} not helpful, so the controller required a different method.`
          : turn.diagnosis,
      strategyChanged: context.session.lastStrategy !== turn.next_strategy,
      evidenceKind,
      evidenceResult,
      independentEvidence,
      responseMode,
      humanSupport,
      reviewAfterDays: nextReviewAfterDays({
        result: evidenceResult,
        masteryStatus: turn.mastery_status,
      }),
      createdAt: now,
    });

    const nextSession = LessonSessionSchema.parse({
      ...context.session,
      status: turn.should_end_session ? "completed" : "active",
      turnCount: sequence,
      lastPrompt: turn.next_question,
      lastDiagnosis: turn.diagnosis,
      lastStrategy: turn.next_strategy,
      masteryStatus: turn.mastery_status,
      masteryEvidence: turn.mastery_evidence,
      anchorObject: turn.anchor_object,
      updatedAt: now,
    });
    const nextLearner = LearnerProfileSchema.parse({
      ...context.learner,
      preferredLanguage: turn.language_mode,
      currentConcept: turn.concept,
      lastMastery: turn.mastery_status,
      updatedAt: now,
    });

    this.#repository.appendTurn(
      StoredTeachingTurnSchema.parse({
        id: this.#makeId(),
        sessionId: nextSession.id,
        sequence,
        turn,
        modelRoute: this.#engine.modelRoute,
        createdAt: now,
      }),
    );
    this.#repository.appendLearningEvidence(evidence);
    this.#repository.appendPedagogyDecision(decision);
    if (responseMode === "dtmf") {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "keypad_fallback_completed",
          learnerId: nextLearner.id,
          sessionId: nextSession.id,
          channel: "dtmf",
          accessMode: nextSession.accessMode,
          numericValue: null,
          synthetic: false,
          createdAt: now,
        }),
      );
    }
    if (nextSession.status === "completed") {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "lesson_completed",
          learnerId: nextLearner.id,
          sessionId: nextSession.id,
          channel: "phone",
          accessMode: nextSession.accessMode,
          numericValue: nextSession.turnCount,
          synthetic: false,
          createdAt: now,
        }),
      );
      if (
        this.#repository.listLearnersForPhone(nextLearner.phoneHash).length > 1
      ) {
        this.#repository.appendProductMetric(
          ProductMetricEventSchema.parse({
            id: this.#makeId(),
            name: "shared_phone_lesson_completed",
            learnerId: nextLearner.id,
            sessionId: nextSession.id,
            channel: "phone",
            accessMode: nextSession.accessMode,
            numericValue: null,
            synthetic: false,
            createdAt: now,
          }),
        );
      }
    }
    if (generated.usage) {
      this.recordModelUsage(
        { ...context, session: nextSession, learner: nextLearner },
        generated.usage,
      );
    }
    this.#repository.saveLesson(nextSession);
    this.#repository.saveLearner(nextLearner);

    return {
      context: {
        learner: nextLearner,
        session: nextSession,
        resumed: context.resumed,
        greeting: context.greeting,
      },
      turn,
      activity,
      evidence,
      decision,
    };
  }

  recordTeachingFeedback(
    context: LessonContext,
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
      subject: this.#curriculumPack.deployment.subject,
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

  recordKeypadFallbackRequested(context: LessonContext): void {
    this.#recordProductMetric(
      context,
      "keypad_fallback_requested",
      "dtmf",
    );
  }

  recordUnclearAudioRecovery(
    context: LessonContext,
    outcome: "requested" | "recovered",
  ): void {
    this.#recordProductMetric(
      context,
      outcome === "requested"
        ? "unclear_audio_recovery_requested"
        : "unclear_audio_recovered",
      "phone",
    );
  }

  setLessonDuration(
    context: LessonContext,
    durationMinutes: LessonDurationMinutes,
  ): LessonContext {
    const duration = LessonDurationMinutesSchema.parse(durationMinutes);
    if (context.session.turnCount > 0) {
      throw new Error("Lesson duration can only change before teaching begins.");
    }
    const session = LessonSessionSchema.parse({
      ...context.session,
      durationMinutes: duration,
      updatedAt: this.#clock().toISOString(),
    });
    this.#repository.saveLesson(session);
    return { ...context, session };
  }

  requestHint(context: LessonContext): {
    context: LessonContext;
    spokenResponse: string;
  } {
    if (context.session.status !== "active") {
      throw new Error("A hint requires an active lesson.");
    }
    const concept = this.#concept(context.session.concept);
    const now = this.#clock().toISOString();
    const session = LessonSessionSchema.parse({
      ...context.session,
      lastPrompt: concept.teachingScaffold.silenceQuestion,
      lastDiagnosis: "The learner explicitly requested a smaller hint.",
      lastStrategy: "hint_ladder",
      updatedAt: now,
    });
    this.#repository.saveLesson(session);
    return {
      context: { ...context, session },
      spokenResponse: `${concept.teachingScaffold.silenceResponseLead} ${concept.teachingScaffold.silenceQuestion}`,
    };
  }

  #recordProductMetric(
    context: LessonContext,
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

  updateEducationProfile(
    context: LessonContext,
    options: {
      consentConfirmed: boolean;
      ageBand?: LearnerEducationProfile["ageBand"];
      reportedGrade?: number | null;
      interests?: string[];
      aspirations?: string[];
      curiosityTopics?: string[];
      preferredExamples?: string[];
      learningGoals?: string[];
      preferredActivities?: LearnerEducationProfile["preferredActivities"];
      preferredPace?: LearnerEducationProfile["preferredPace"];
    },
  ): LearnerEducationProfile {
    if (!options.consentConfirmed) {
      throw new Error("Learning preferences require explicit learner consent.");
    }
    const now = this.#clock().toISOString();
    const existing =
      this.#repository.findEducationProfile(context.learner.id) ??
      LearnerEducationProfileSchema.parse({
        learnerId: context.learner.id,
        ageBand: "unknown",
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
      });
    const fieldMap = {
      ageBand: "age_band",
      reportedGrade: "reported_grade",
      interests: "interests",
      aspirations: "aspirations",
      curiosityTopics: "curiosity_topics",
      preferredExamples: "preferred_examples",
      learningGoals: "learning_goals",
      preferredActivities: "preferred_activities",
      preferredPace: "preferred_pace",
    } as const;
    const consented = new Set(existing.consentedFields);
    const updates: Record<string, unknown> = {};
    for (const [field, consentField] of Object.entries(fieldMap) as [
      keyof typeof fieldMap,
      (typeof fieldMap)[keyof typeof fieldMap],
    ][]) {
      if (options[field] !== undefined) {
        updates[field] = options[field];
        consented.add(consentField);
      }
    }
    if (Object.keys(updates).length === 0) {
      throw new Error("At least one approved learning preference is required.");
    }
    const profile = LearnerEducationProfileSchema.parse({
      ...existing,
      ...updates,
      consentedFields: [...consented],
      updatedAt: now,
    });
    this.#repository.saveEducationProfile(profile);
    return profile;
  }

  educationProfile(context: LessonContext): LearnerEducationProfile | undefined {
    return this.#repository.findEducationProfile(context.learner.id);
  }

  homeworkDraft(context: LessonContext): HomeworkDraft {
    const concept = this.#concept(context.session.concept);
    const question = concept.keypadQuestions[0];
    if (!question) {
      throw new Error(`Concept ${concept.id} has no reviewed homework question.`);
    }
    const correctIndex = question.choices.findIndex((choice) => choice.correct);
    if (correctIndex < 0) {
      throw new Error(`Question ${question.id} has no reviewed correct answer.`);
    }
    return {
      curriculumPackId: this.#curriculumPack.id,
      concept: concept.id,
      reviewedQuestionId: question.id,
      prompt: question.featurePhoneSms,
      choices: question.choices.map((choice, index) => ({
        key: String(index + 1) as "1" | "2" | "3" | "4",
        label: choice.label,
      })),
      correctKey: String(correctIndex + 1) as "1" | "2" | "3" | "4",
    };
  }

  learningMenu(context: { learner: LearnerProfile }): string {
    return `Welcome, ${context.learner.name}. Would you like guided ${this.#curriculumPack.deployment.subject}, or Curious Sandbox where you can ask anything?`;
  }

  modeGreeting(context: LessonContext, mode: CallLearningMode): string {
    return mode === "guided"
      ? context.greeting
      : "Curious Sandbox is open. What are you curious about?";
  }

  requiresPlacement(context: LessonContext): boolean {
    return context.session.placementLevel === "unplaced";
  }

  placementQuestions(_context?: LessonContext): { id: string; prompt: string }[] {
    return this.#curriculumPack.placementDiagnostic.questions.map(
      ({ id, prompt }) => ({ id, prompt }),
    );
  }

  async completePlacement(
    context: LessonContext,
    answers: PlacementAnswer[],
  ): Promise<{
    context: LessonContext;
    result: PlacementResult;
    spokenResponse: string;
  }> {
    const redactedAnswers = answers.map((answer) => ({
      ...answer,
      answer: redactPotentialPii(answer.answer),
    }));
    const evaluation = await this.#engine.evaluatePlacement({
      learnerId: context.learner.id,
      answers: redactedAnswers,
    });
    const result = placementResultFromEvaluation(
      this.#curriculumPack,
      evaluation.value,
    );
    const concept = this.#curriculumPack.concepts.find(
      (candidate) => candidate.id === result.recommendedConcept,
    );
    if (!concept) {
      throw new Error(
        `Placement recommendation ${result.recommendedConcept} is not a curriculum concept.`,
      );
    }
    const now = this.#clock().toISOString();
    const nextLearner = LearnerProfileSchema.parse({
      ...context.learner,
      currentConcept: concept.id,
      placementLevel: result.level,
      placementScore: result.score,
      placementTotal: result.total,
      placementEvidence: result.evidence,
      updatedAt: now,
    });
    const nextSession = LessonSessionSchema.parse({
      ...context.session,
      concept:
        context.session.turnCount === 0 ? concept.id : context.session.concept,
      lastPrompt:
        context.session.turnCount === 0
          ? concept.teachingScaffold.entryQuestion
          : context.session.lastPrompt,
      placementLevel: result.level,
      placementScore: result.score,
      placementTotal: result.total,
      placementEvidence: result.evidence,
      updatedAt: now,
    });
    this.#repository.saveLearner(nextLearner);
    this.#repository.saveLesson(nextSession);
    const nextContext = {
      ...context,
      learner: nextLearner,
      session: nextSession,
    };
    if (evaluation.usage) this.recordModelUsage(nextContext, evaluation.usage);
    return {
      context: nextContext,
      result,
      spokenResponse: `Thanks. We will begin with ${concept.title}. ${nextSession.lastPrompt}`,
    };
  }

  pause(
    context: LessonContext,
    reason: "manual" | "drop" = "manual",
  ): LessonContext {
    if (context.session.status === "completed") return context;
    const pausedSession = LessonSessionSchema.parse({
      ...context.session,
      status: "paused",
      updatedAt: this.#clock().toISOString(),
    });
    this.#repository.saveLesson(pausedSession);
    if (reason === "drop") {
      this.#repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: this.#makeId(),
          name: "drop_paused",
          learnerId: context.learner.id,
          sessionId: context.session.id,
          channel: "phone",
          accessMode: context.session.accessMode,
          numericValue: context.session.turnCount + 1,
          synthetic: false,
          createdAt: this.#clock().toISOString(),
        }),
      );
    }
    return { ...context, session: pausedSession };
  }

  async learningHistory(
    context: LessonContext,
  ): Promise<LearningHistoryResponse> {
    const entries = this.#repository
      .listRecentLessons(100)
      .filter(
        (session) =>
          session.learnerId === context.learner.id &&
          session.curriculumPackId === this.#curriculumPack.id &&
          session.turnCount > 0,
      )
      .slice(0, 20)
      .map((session) => ({
        concept: session.concept,
        conceptTitle: this.#concept(session.concept).title,
        status: session.status,
        turnCount: session.turnCount,
        masteryStatus: session.masteryStatus,
        masteryEvidence: session.masteryEvidence,
        lastDiagnosis: session.lastDiagnosis,
      }));
    const result = await this.#engine.summarizeHistory({
      learnerId: context.learner.id,
      requestedLanguageMode: context.learner.preferredLanguage,
      entries,
    });
    if (result.usage) this.recordModelUsage(context, result.usage);
    return result.value;
  }

  async exploreSandbox(
    context: LessonContext,
    learnerQuestion: string,
  ): Promise<SandboxTurn> {
    const redactedQuestion = redactPotentialPii(learnerQuestion);
    const priorTurns = this.#repository
      .listSandboxTurns(context.session.id)
      .slice(-6)
      .map((entry) => ({
        learnerQuestion: entry.turn.learner_question,
        spokenResponse: entry.turn.spoken_response,
        followUpQuestion: entry.turn.follow_up_question,
        certainty: entry.turn.certainty,
      }));
    const result = await this.#engine.explore({
      learnerId: context.learner.id,
      learnerQuestion: redactedQuestion,
      requestedLanguageMode: context.learner.preferredLanguage,
      previousTurns: priorTurns,
    });
    const turn = SandboxTurnSchema.parse({
      ...result.value,
      learner_id: context.learner.id,
      learner_question: redactedQuestion,
    });
    const now = this.#clock().toISOString();
    const sequence =
      this.#repository.listSandboxTurns(context.session.id).length + 1;
    this.#repository.appendSandboxTurn(
      StoredSandboxTurnSchema.parse({
        id: this.#makeId(),
        sessionId: context.session.id,
        sequence,
        turn,
        modelRoute: this.#engine.modelRoute,
        createdAt: now,
      }),
    );
    this.#repository.saveLesson(
      LessonSessionSchema.parse({ ...context.session, updatedAt: now }),
    );
    if (result.usage) this.recordModelUsage(context, result.usage);
    return turn;
  }

  createCuriosityTrail(context: LessonContext): CuriosityTrail {
    const turns = this.#repository.listSandboxTurns(context.session.id);
    const first = turns[0]?.turn;
    const latest = turns.at(-1)?.turn;
    if (!first || !latest) {
      throw new Error("A Curiosity Trail requires at least one curiosity turn.");
    }
    const now = this.#clock().toISOString();
    const trail = CuriosityTrailSchema.parse({
      id: this.#makeId(),
      learnerId: context.learner.id,
      sessionId: context.session.id,
      originalQuestion: first.learner_question,
      summary: latest.spoken_response,
      relatedQuestions: turns
        .map((entry) => entry.turn.follow_up_question)
        .filter((question, index, all) => all.indexOf(question) === index)
        .slice(0, 8),
      flashcards: [],
      suggestedNextCallAt: null,
      relatedCurriculumPackId: null,
      relatedConceptId: null,
      learnerApproved: true,
      safetyStatus: turns.some(
        (entry) => entry.turn.safety_status === "redirect",
      )
        ? "redirect"
        : "safe",
      certainty: turns.some((entry) => entry.turn.certainty === "low")
        ? "low"
        : turns.some((entry) => entry.turn.certainty === "medium")
          ? "medium"
          : "high",
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveCuriosityTrail(trail);
    return trail;
  }

  recordModelUsage(context: LessonContext, usage: ModelUsage): void {
    this.#repository.appendUsage(
      StoredModelUsageSchema.parse({
        ...usage,
        id: this.#makeId(),
        sessionId: context.session.id,
        createdAt: this.#clock().toISOString(),
      }),
    );
  }

  #concept(conceptId: string): CurriculumPack["concepts"][number] {
    const concept = this.#curriculumPack.concepts.find(
      (candidate) => candidate.id === conceptId,
    );
    if (!concept) {
      throw new Error(
        `Concept ${conceptId} is not present in curriculum pack ${this.#curriculumPack.id}.`,
      );
    }
    return concept;
  }

  #retrievalQuestion(
    concept: CurriculumPack["concepts"][number],
    completedTurns: number,
  ): string {
    return (
      concept.retrievalQuestions[
        completedTurns % concept.retrievalQuestions.length
      ] ?? concept.retrievalQuestions[0]!
    );
  }
}
