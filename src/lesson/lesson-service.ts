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
import type { TeachingEngine } from "../engine/teaching-engine.js";
import {
  placementResultFromEvaluation,
  type PlacementAnswer,
  type PlacementResult,
} from "../engine/placement-diagnostic.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";

export interface LessonContext {
  learner: LearnerProfile;
  session: LessonSession;
  resumed: boolean;
  greeting: string;
}

export type CallLearningMode = "guided" | "curious_sandbox";

export interface LessonServiceOptions {
  repository: LearningRepository;
  engine: TeachingEngine;
  clock?: () => Date;
  makeId?: () => string;
  phoneHashSecret: string;
  curriculumPack: CurriculumPack;
}

export class LessonService {
  readonly #repository: LearningRepository;
  readonly #engine: TeachingEngine;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #phoneHashSecret: string;
  readonly #curriculumPack: CurriculumPack;
  readonly #startingConcept: CurriculumPack["concepts"][number];

  constructor(options: LessonServiceOptions) {
    this.#repository = options.repository;
    this.#engine = options.engine;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#curriculumPack = options.curriculumPack;
    const startingConcept = options.curriculumPack.concepts[0];
    if (!startingConcept) throw new Error("The curriculum pack has no concepts.");
    this.#startingConcept = startingConcept;
  }

  beginOrResume(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LessonContext {
    const nowDate = this.#clock();
    const now = nowDate.toISOString();
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

    const existingLesson = this.#repository.findResumableLesson(learner.id);
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
        status: "active",
        lastPrompt: prompt,
        updatedAt: now,
      });
      this.#repository.saveLesson(resumedLesson);
      return {
        learner,
        session: resumedLesson,
        resumed: true,
        greeting: `${isRecentDrop ? this.#curriculumPack.lessonPolicy.recentResumeLead : this.#curriculumPack.lessonPolicy.returnRetrievalLead} ${prompt}`,
      };
    }

    const latestLesson = existingLearner
      ? this.#repository.findLatestLesson(learner.id)
      : undefined;
    const concept = latestLesson
      ? this.#concept(latestLesson.concept)
      : this.#startingConcept;
    const firstPrompt = latestLesson
      ? this.#retrievalQuestion(concept, latestLesson.turnCount)
      : concept.teachingScaffold.entryQuestion;

    const session = LessonSessionSchema.parse({
      id: this.#makeId(),
      learnerId: learner.id,
      concept: concept.id,
      status: "active",
      turnCount: 0,
      lastPrompt: firstPrompt,
      lastDiagnosis: "No evidence yet.",
      lastStrategy: "ask_reasoning",
      masteryStatus: learner.lastMastery,
      masteryEvidence: "No evidence yet.",
      createdAt: now,
      updatedAt: now,
    });
    this.#repository.saveLesson(session);

    return {
      learner,
      session,
      resumed: Boolean(latestLesson),
      greeting: latestLesson
        ? `${this.#curriculumPack.lessonPolicy.returnRetrievalLead} ${firstPrompt}`
        : `Hello, ${learner.name}. ${firstPrompt}`,
    };
  }

  async respond(
    context: LessonContext,
    learnerAnswer: string,
  ): Promise<{ context: LessonContext; turn: TeachingTurn }> {
    const sequence = context.session.turnCount + 1;
    const targetTurns = this.#curriculumPack.lessonPolicy.targetTurns;
    const phase: LessonPhase =
      sequence >= targetTurns
        ? "recap"
        : sequence === targetTurns - 1
          ? "check"
          : "explore";
    const priorReasoningEvidenceCount = this.#repository
      .listTurns(context.session.id)
      .filter((entry) => entry.turn.mastery_status !== "needs_support").length;
    const previousTurns = this.#repository.listTurns(context.session.id);
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
        placementLevel: context.learner.placementLevel,
      },
    });
    const generatedTurn = generated.value;
    const shouldEndForSafety =
      generatedTurn.next_strategy === "safety_redirect" &&
      consecutiveSafetyRedirects + 1 >=
        this.#curriculumPack.safetyPolicy.maxConsecutiveRedirects;
    const turn = TeachingTurnSchema.parse({
      ...generatedTurn,
      learner_answer: redactedLearnerAnswer,
      mastery_status:
        generatedTurn.mastery_status === "secure" &&
        priorReasoningEvidenceCount < 1
          ? "developing"
          : generatedTurn.mastery_status,
      next_strategy:
        phase === "recap" ? "recap" : generatedTurn.next_strategy,
      should_end_session: phase === "recap" || shouldEndForSafety,
    });
    const now = this.#clock().toISOString();

    const nextSession = LessonSessionSchema.parse({
      ...context.session,
      status: turn.should_end_session ? "completed" : "active",
      turnCount: sequence,
      lastPrompt: turn.next_question,
      lastDiagnosis: turn.diagnosis,
      lastStrategy: turn.next_strategy,
      masteryStatus: turn.mastery_status,
      masteryEvidence: turn.mastery_evidence,
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
    };
  }

  learningMenu(context: LessonContext): string {
    return `Welcome, ${context.learner.name}. Would you like guided ${this.#curriculumPack.deployment.subject}, or Curious Sandbox where you can ask anything?`;
  }

  modeGreeting(context: LessonContext, mode: CallLearningMode): string {
    return mode === "guided"
      ? context.greeting
      : "Curious Sandbox is open. What are you curious about?";
  }

  requiresPlacement(context: LessonContext): boolean {
    return context.learner.placementLevel === "unplaced";
  }

  placementQuestions(): { id: string; prompt: string }[] {
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

  pause(context: LessonContext): LessonContext {
    if (context.session.status === "completed") return context;
    const pausedSession = LessonSessionSchema.parse({
      ...context.session,
      status: "paused",
      updatedAt: this.#clock().toISOString(),
    });
    this.#repository.saveLesson(pausedSession);
    return { ...context, session: pausedSession };
  }

  async learningHistory(
    context: LessonContext,
  ): Promise<LearningHistoryResponse> {
    const entries = this.#repository
      .listRecentLessons(100)
      .filter(
        (session) =>
          session.learnerId === context.learner.id && session.turnCount > 0,
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
    const result = await this.#engine.explore({
      learnerId: context.learner.id,
      learnerQuestion: redactedQuestion,
      requestedLanguageMode: context.learner.preferredLanguage,
    });
    const turn = SandboxTurnSchema.parse({
      ...result.value,
      learner_id: context.learner.id,
      learner_question: redactedQuestion,
    });
    const now = this.#clock().toISOString();
    const sequence = this.#repository.listSandboxTurns(context.session.id).length + 1;
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
