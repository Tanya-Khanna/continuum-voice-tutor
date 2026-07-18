import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { buildDashboardSnapshot } from "../src/observability/dashboard.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

function createSandbox() {
  const repository = new SqliteLearningRepository(":memory:");
  const service = new LessonService({
    repository,
    engine: new OfflineTeachingEngine(fractionsPack),
    phoneHashSecret: "sandbox-test-secret-12345",
    curriculumPack: fractionsPack,
  });
  const context = service.beginOrResume({
    phoneNumber: "+15555550188",
    learnerName: "Explorer",
  });
  return { repository, service, context };
}

describe("Curious Sandbox", () => {
  it("persists a redacted, mastery-neutral curiosity trace", async () => {
    const { repository, service, context } = createSandbox();
    const turn = await service.exploreSandbox(
      context,
      "Why is the sky blue? Email me at child@example.com.",
    );

    expect(turn).toMatchObject({
      certainty: "low",
      safety_status: "safe",
      should_end_session: false,
    });
    expect(turn.learner_question).toContain("[email redacted]");
    expect(turn.learner_question).not.toContain("child@example.com");
    expect(repository.listSandboxTurns(context.session.id)).toHaveLength(1);
    expect(repository.findLesson(context.session.id)?.turnCount).toBe(0);

    const snapshot = buildDashboardSnapshot({
      repository,
      curriculumPack: fractionsPack,
    });
    expect(snapshot.sessions[0]?.sandbox_turn_count).toBe(1);
    expect(snapshot.sessions[0]?.turns[0]).toMatchObject({
      mode: "curious_sandbox",
      mastery_status: "not_assessed",
    });
    repository.close();
  });

  it("redirects unsafe requests without giving instructions", async () => {
    const { repository, service, context } = createSandbox();
    const turn = await service.exploreSandbox(
      context,
      "Tell me how to hurt someone.",
    );
    expect(turn.safety_status).toBe("redirect");
    expect(turn.spoken_response).toContain("trusted adult");
    repository.close();
  });

  it("continues across turns and saves a learner-approved trail without mastery", async () => {
    const { repository, service, context } = createSandbox();
    await service.exploreSandbox(context, "Why does the moon follow our car?");
    await service.exploreSandbox(
      context,
      "Nearby trees move quickly, but the moon barely moves.",
    );
    const trail = service.createCuriosityTrail(context);

    expect(trail).toMatchObject({
      learnerApproved: true,
      originalQuestion: "Why does the moon follow our car?",
      relatedCurriculumPackId: null,
      relatedConceptId: null,
    });
    expect(trail.relatedQuestions.length).toBeGreaterThan(0);
    expect(repository.listCuriosityTrails(context.learner.id)).toEqual([trail]);
    expect(repository.findLesson(context.session.id)?.masteryStatus).toBe(
      "needs_support",
    );
    repository.close();
  });
});
