import type { CurriculumCatalog } from "../curriculum/catalog.js";
import type { LearnerProfile, LearningRepository } from "../domain/learner.js";
import type { SandboxTurn } from "../domain/sandbox.js";
import type { LanguageMode, TeachingTurn } from "../domain/teaching.js";
import type { ModelUsage } from "../domain/usage.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";
import type {
  PlacementAnswer,
  PlacementResult,
} from "../engine/placement-diagnostic.js";
import {
  LessonService,
  type CallLearningMode,
  type LessonContext,
} from "./lesson-service.js";
import type { LearningHistoryResponse } from "../domain/history.js";
import type {
  LessonDurationMinutes,
  LearnerResponseMode,
  LessonResponse,
} from "./lesson-service.js";
import type { TeachingFeedback } from "../domain/classroom.js";
import type { CuriosityTrail } from "../domain/classroom.js";
import type { LearnerEducationProfile } from "../domain/classroom.js";
import type { AccessMode } from "../domain/product-metrics.js";

function spokenList(values: readonly string[]): string {
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

export class CatalogLessonService {
  readonly #catalog: CurriculumCatalog;
  readonly #services = new Map<string, LessonService>();

  constructor(options: {
    repository: LearningRepository;
    catalog: CurriculumCatalog;
    engineFactory: (packId: string) => TeachingEngine;
    phoneHashSecret: string;
    clock?: () => Date;
    makeId?: () => string;
  }) {
    this.#catalog = options.catalog;
    for (const [index, option] of options.catalog.list().entries()) {
      this.#services.set(
        option.id,
        new LessonService({
          repository: options.repository,
          engine: options.engineFactory(option.id),
          phoneHashSecret: options.phoneHashSecret,
          curriculumPack: option.pack,
          acceptLegacySessions: index === 0,
          ...(options.clock ? { clock: options.clock } : {}),
          ...(options.makeId ? { makeId: options.makeId } : {}),
        }),
      );
    }
  }

  availableSubjects(): string[] {
    return this.#catalog.subjects();
  }

  findLearner(learnerId: string): LearnerProfile | undefined {
    return this.#defaultService().findLearner(learnerId);
  }

  subjectForContext(context: LessonContext): string {
    return this.#catalog.requireByPackId(
      context.session.curriculumPackId,
    ).subject;
  }

  identifyLearner(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LearnerProfile {
    return this.#defaultService().identifyLearner(options);
  }

  beginOrResume(options: {
    phoneNumber: string;
    learnerName: string;
    preferredLanguage?: Exclude<LanguageMode, "auto">;
  }): LessonContext {
    return this.#defaultService().beginOrResume(options);
  }

  beginOrResumeSubject(
    learner: LearnerProfile,
    subject?: string,
    accessMode: AccessMode = "unknown",
  ): LessonContext {
    const option = subject
      ? this.#catalog.requireBySubject(subject)
      : this.#catalog.defaultOption;
    return this.#requireService(option.id).beginOrResumeLearner(
      learner,
      accessMode,
    );
  }

  learningMenu(context: { learner: LearnerProfile }): string {
    const subjects = this.availableSubjects();
    if (subjects.length === 1) {
      return this.#defaultService().learningMenu(context);
    }
    return `Welcome, ${context.learner.name}. Choose a guided subject: ${spokenList(subjects)}. Or choose Curious Sandbox where you can ask anything.`;
  }

  modeGreeting(context: LessonContext, mode: CallLearningMode): string {
    return this.#serviceForContext(context).modeGreeting(context, mode);
  }

  requiresPlacement(context: LessonContext): boolean {
    return this.#serviceForContext(context).requiresPlacement(context);
  }

  placementQuestions(context: LessonContext): { id: string; prompt: string }[] {
    return this.#serviceForContext(context).placementQuestions(context);
  }

  completePlacement(
    context: LessonContext,
    answers: PlacementAnswer[],
  ): Promise<{
    context: LessonContext;
    result: PlacementResult;
    spokenResponse: string;
  }> {
    return this.#serviceForContext(context).completePlacement(context, answers);
  }

  respond(
    context: LessonContext,
    learnerAnswer: string,
    options: { responseMode?: LearnerResponseMode } = {},
  ): Promise<LessonResponse> {
    return this.#serviceForContext(context).respond(
      context,
      learnerAnswer,
      options,
    );
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
    return this.#serviceForContext(context).recordTeachingFeedback(
      context,
      options,
    );
  }

  recordKeypadFallbackRequested(context: LessonContext): void {
    this.#serviceForContext(context).recordKeypadFallbackRequested(context);
  }

  recordUnclearAudioRecovery(
    context: LessonContext,
    outcome: "requested" | "recovered",
  ): void {
    this.#serviceForContext(context).recordUnclearAudioRecovery(
      context,
      outcome,
    );
  }

  setLessonDuration(
    context: LessonContext,
    durationMinutes: LessonDurationMinutes,
  ): LessonContext {
    return this.#serviceForContext(context).setLessonDuration(
      context,
      durationMinutes,
    );
  }

  requestHint(context: LessonContext) {
    return this.#serviceForContext(context).requestHint(context);
  }

  pause(
    context: LessonContext,
    reason: "manual" | "drop" = "manual",
  ): LessonContext {
    return this.#serviceForContext(context).pause(context, reason);
  }

  learningHistory(context: LessonContext): Promise<LearningHistoryResponse> {
    return this.#serviceForContext(context).learningHistory(context);
  }

  exploreSandbox(
    context: LessonContext,
    learnerQuestion: string,
  ): Promise<SandboxTurn> {
    return this.#serviceForContext(context).exploreSandbox(
      context,
      learnerQuestion,
    );
  }

  createCuriosityTrail(context: LessonContext): CuriosityTrail {
    return this.#serviceForContext(context).createCuriosityTrail(context);
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
    return this.#serviceForContext(context).updateEducationProfile(
      context,
      options,
    );
  }

  educationProfile(context: LessonContext): LearnerEducationProfile | undefined {
    return this.#serviceForContext(context).educationProfile(context);
  }

  homeworkDraft(context: LessonContext) {
    return this.#serviceForContext(context).homeworkDraft(context);
  }

  recordModelUsage(context: LessonContext, usage: ModelUsage): void {
    this.#serviceForContext(context).recordModelUsage(context, usage);
  }

  #defaultService(): LessonService {
    return this.#requireService(this.#catalog.defaultOption.id);
  }

  #serviceForContext(context: LessonContext): LessonService {
    return this.#requireService(context.session.curriculumPackId);
  }

  #requireService(packId: string): LessonService {
    const service = this.#services.get(packId);
    if (!service) {
      throw new Error(`No lesson service for curriculum pack ${packId}.`);
    }
    return service;
  }
}
