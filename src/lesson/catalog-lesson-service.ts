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
  ): LessonContext {
    const option = subject
      ? this.#catalog.requireBySubject(subject)
      : this.#catalog.defaultOption;
    return this.#requireService(option.id).beginOrResumeLearner(learner);
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
  ): Promise<{ context: LessonContext; turn: TeachingTurn }> {
    return this.#serviceForContext(context).respond(context, learnerAnswer);
  }

  pause(context: LessonContext): LessonContext {
    return this.#serviceForContext(context).pause(context);
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
