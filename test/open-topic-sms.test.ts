import { describe, expect, it } from "vitest";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { GuardianAccessService } from "../src/guardian/guardian-access-service.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { HomeworkService } from "../src/messaging/homework-service.js";
import { OpenTopicSmsService } from "../src/messaging/open-topic-sms-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "open-topic-sms-test-secret";
const PHONE = "+919999900001";

function payload(id: string, body: string) {
  return {
    MessageSid: `SM${id.repeat(32).slice(0, 32)}`,
    From: PHONE,
    To: "+14155550100",
    Body: body,
  };
}

function fixture() {
  const repository = new SqliteLearningRepository(":memory:");
  const lessons = new OpenTopicLessonService({
    repository,
    engine: new OfflineOpenTopicEngine(),
    phoneHashSecret: SECRET,
  });
  const learner = lessons.identifyLearner({
    phoneNumber: PHONE,
    learnerName: "Meena",
  });
  const context = lessons.beginOrResumeLearner(learner);
  const guardian = new GuardianAccessService({
    repository,
    secret: SECRET,
    phoneHashSecret: SECRET,
    makeCode: () => "654321",
  });
  const code = guardian.issue({
    learnerId: learner.id,
    guardianPhoneNumber: PHONE,
    smsAllowed: true,
    proactiveCallsAllowed: false,
  });
  const homework = new HomeworkService({
    repository,
    phoneHashSecret: SECRET,
    makeCode: () => "ABC123",
  });
  const sms = new OpenTopicSmsService({
    repository,
    guardianAccess: guardian,
    homeworkService: homework,
  });
  return { repository, lessons, learner, context, guardian, code, homework, sms };
}

describe("open-topic SMS thread", () => {
  it("is bounded and does not reactivate the removed outbound-call scheduler", () => {
    const { repository, learner, code, sms } = fixture();
    const unbounded = sms.handle(payload("a", "Can you teach me a whole lesson here?"));
    expect(unbounded.action).toBe("bounded_help");
    expect(unbounded.responseText).toContain("Commands:");

    const start = sms.handle(payload("b", `START ${code}`));
    expect(start.action).toBe("outbound_calls_disabled");
    expect(start.responseText).toContain("does not schedule repeated tutoring calls");
    expect(repository.findStudyPlan(learner.id)).toBeUndefined();

    const stop = sms.handle(payload("c", `STOP ${code}`));
    expect(stop.responseText).toContain("proactive messages and calls stopped");
    expect(
      repository.findGuardianAuthorization(learner.id)?.proactiveCallsAllowed,
    ).toBe(false);
    repository.close();
  });

  it("binds one-question practice to the authorized phone and records bounded evidence", () => {
    const { repository, learner, context, homework, sms } = fixture();
    homework.assign({
      learnerId: learner.id,
      sessionId: context.session.id,
      recipientPhoneNumber: PHONE,
      draft: {
        curriculumPackId: "continuum-open-topic-v1",
        concept: "unit fractions",
        reviewedQuestionId: "dynamic-transfer-1",
        prompt: "Which is larger? 1 half, 2 one fifth",
        choices: [
          { key: "1", label: "one half" },
          { key: "2", label: "one fifth" },
        ],
        correctKey: "1",
      },
    });
    const incoming = payload("d", "HW ABC123 1");
    const receipt = sms.handle(incoming);
    expect(receipt).toMatchObject({
      action: "practice",
      learnerId: learner.id,
    });
    expect(receipt.responseText).toContain("correct");
    expect(sms.handle(incoming)).toEqual(receipt);
    expect(
      repository
        .listLearningEvidence(learner.id)
        .filter((evidence) => evidence.kind === "homework"),
    ).toHaveLength(1);
    repository.close();
  });

  it("exposes selective memory and preserves two-step deletion", async () => {
    const { repository, lessons, learner, context, code, sms } = fixture();
    await lessons.respond(context, "Teach me why the moon changes shape.");
    const memory = sms.handle(payload("e", `MEMORY ${code}`));
    expect(memory.responseText).toContain("exact next step");
    expect(memory.responseText).toContain("No raw call recording");

    const requested = sms.handle(payload("f", `DELETE ${code}`));
    expect(requested.action).toBe("delete_requested");
    expect(repository.findLearner(learner.id)).toBeDefined();
    const deleted = sms.handle(payload("1", `DELETE ${code} CONFIRM`));
    expect(deleted.action).toBe("deleted");
    expect(repository.findLearner(learner.id)).toBeUndefined();
    repository.close();
  });
});
