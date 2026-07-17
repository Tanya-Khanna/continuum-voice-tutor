import { randomUUID } from "node:crypto";
import { hashPhoneNumber, normalizeLearnerName } from "../domain/identity.js";
import {
  LearnerProfileSchema,
  LessonSessionSchema,
  StoredTeachingTurnSchema,
  type LearnerProfile,
  type LearningRepository,
  type LessonSession,
} from "../domain/learner.js";
import type {
  LanguageMode,
  TeachingTurn,
} from "../domain/teaching.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";

const FIRST_QUESTION =
  "Which is the bigger share, one third or one fourth? Tell me why.";

export interface LessonContext {
  learner: LearnerProfile;
  session: LessonSession;
  resumed: boolean;
  greeting: string;
}

export interface LessonServiceOptions {
  repository: LearningRepository;
  engine: TeachingEngine;
  clock?: () => Date;
  makeId?: () => string;
  phoneHashSecret: string;
}

export class LessonService {
  readonly #repository: LearningRepository;
  readonly #engine: TeachingEngine;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #phoneHashSecret: string;

  constructor(options: LessonServiceOptions) {
    this.#repository = options.repository;
    this.#engine = options.engine;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
    this.#phoneHashSecret = options.phoneHashSecret;
  }

  beginOrResume(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LessonContext {
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
        preferredLanguage: options.preferredLanguage ?? "en",
        currentConcept: "comparing_unit_fractions",
        lastMastery: "needs_support",
        createdAt: now,
        updatedAt: now,
      });

    if (!existingLearner) this.#repository.saveLearner(learner);

    const existingLesson = this.#repository.findResumableLesson(learner.id);
    if (existingLesson) {
      const resumedLesson = LessonSessionSchema.parse({
        ...existingLesson,
        status: "active",
        updatedAt: now,
      });
      this.#repository.saveLesson(resumedLesson);
      return {
        learner,
        session: resumedLesson,
        resumed: true,
        greeting: `Welcome back, ${learner.name}. Last time we were working on ${resumedLesson.concept.replaceAll("_", " ")}. ${resumedLesson.lastPrompt}`,
      };
    }

    const session = LessonSessionSchema.parse({
      id: this.#makeId(),
      learnerId: learner.id,
      concept: learner.currentConcept,
      status: "active",
      turnCount: 0,
      lastPrompt: FIRST_QUESTION,
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
      resumed: false,
      greeting: `Hello, ${learner.name}. ${FIRST_QUESTION}`,
    };
  }

  async respond(
    context: LessonContext,
    learnerAnswer: string,
  ): Promise<{ context: LessonContext; turn: TeachingTurn }> {
    const turn = await this.#engine.teach({
      learnerId: context.learner.id,
      concept: context.session.concept,
      learnerAnswer,
      requestedLanguageMode: "auto",
    });
    const now = this.#clock().toISOString();
    const sequence = context.session.turnCount + 1;

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
        createdAt: now,
      }),
    );
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
}
