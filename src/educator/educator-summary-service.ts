import type { LearningRepository } from "../domain/learner.js";
import {
  EducatorAssignmentSchema,
  EducatorSummarySchema,
  type EducatorAssignment,
  type EducatorSummary,
} from "../domain/educator.js";

export class EducatorSummaryService {
  readonly #repository: LearningRepository;
  readonly #clock: () => Date;

  constructor(options: {
    repository: LearningRepository;
    clock?: () => Date;
  }) {
    this.#repository = options.repository;
    this.#clock = options.clock ?? (() => new Date());
  }

  build(
    unparsedAssignment: EducatorAssignment,
    subject: string,
  ): EducatorSummary {
    const assignment = EducatorAssignmentSchema.parse(unparsedAssignment);
    if (!assignment.learnerAuthorized || !assignment.guardianAuthorized) {
      throw new Error("Educator summaries require learner and guardian authorization.");
    }
    if (
      assignment.authorizationExpiresAt &&
      assignment.authorizationExpiresAt <= this.#clock().toISOString()
    ) {
      throw new Error("Educator-summary authorization has expired.");
    }
    const learner = this.#repository.findLearner(assignment.learnerId);
    if (!learner) throw new Error("Learner profile is unavailable.");
    const sessions = this.#repository
      .listRecentLessons(100)
      .filter(
        (session) =>
          session.learnerId === learner.id &&
          session.curriculumPackId === assignment.curriculumPackId,
      );
    const latestByConcept = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) {
      if (!latestByConcept.has(session.concept)) {
        latestByConcept.set(session.concept, session);
      }
    }
    const decisions = sessions.flatMap((session) =>
      this.#repository.listPedagogyDecisions(session.id),
    );
    const suggestedHumanSupport = decisions.some(
      (decision) => decision.humanSupport === "suggest_teacher",
    )
      ? "The learner may benefit from a teacher checking the current misconception."
      : null;
    return EducatorSummarySchema.parse({
      learnerId: learner.id,
      displayName: learner.name,
      lessonsCompleted: sessions.filter(
        (session) => session.status === "completed",
      ).length,
      assignedSubject: subject,
      conceptStates: [...latestByConcept.values()].map((session) => ({
        conceptId: session.concept,
        mastery: session.masteryStatus,
        evidenceSummary: session.masteryEvidence,
      })),
      suggestedHumanSupport,
      excludesRawConversations: true,
      generatedAt: this.#clock().toISOString(),
    });
  }
}
