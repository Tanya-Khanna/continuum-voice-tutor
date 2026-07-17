import type { CatalogLessonService } from "../lesson/catalog-lesson-service.js";

export const DEMO_LEARNER = {
  name: "Ravi",
  phoneNumber: "+910000000042",
  preferredLanguage: "en",
} as const;

export interface SeedDemoStateResult {
  created: boolean;
  learnerName: string;
  phoneNumber: string;
  subject: string;
  turnCount: number;
  pendingPrompt: string;
}

export async function seedDemoState(options: {
  lessonService: CatalogLessonService;
}): Promise<SeedDemoStateResult> {
  const subject = options.lessonService
    .availableSubjects()
    .find((candidate) => candidate.toLocaleLowerCase("en-US") === "math");
  if (!subject) {
    throw new Error("The Ravi demo fixture requires the reviewed Math pack.");
  }

  const learner = options.lessonService.identifyLearner({
    phoneNumber: DEMO_LEARNER.phoneNumber,
    learnerName: DEMO_LEARNER.name,
    preferredLanguage: DEMO_LEARNER.preferredLanguage,
  });
  let context = options.lessonService.beginOrResumeSubject(learner, subject);
  const created = context.session.turnCount === 0;

  if (created) {
    if (options.lessonService.requiresPlacement(context)) {
      context = (
        await options.lessonService.completePlacement(
          context,
          options.lessonService.placementQuestions(context).map((question) => ({
            questionId: question.id,
            answer: "I am not sure yet.",
          })),
        )
      ).context;
    }
    context = (
      await options.lessonService.respond(
        context,
        "One fourth is bigger because four is bigger than three.",
      )
    ).context;
  }

  context = options.lessonService.pause(context);
  return {
    created,
    learnerName: context.learner.name,
    phoneNumber: DEMO_LEARNER.phoneNumber,
    subject: options.lessonService.subjectForContext(context),
    turnCount: context.session.turnCount,
    pendingPrompt: context.session.lastPrompt,
  };
}
