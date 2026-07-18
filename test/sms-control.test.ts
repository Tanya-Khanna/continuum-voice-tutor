import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { smsSegmentInfo } from "../src/domain/sms-control.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { GuardianAccessService } from "../src/guardian/guardian-access-service.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { SmsControlService } from "../src/messaging/sms-control-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "sms-control-test-secret-123";

function setup() {
  const repository = new SqliteLearningRepository(":memory:");
  const lessons = new LessonService({
    repository,
    engine: new OfflineTeachingEngine(fractionsPack),
    phoneHashSecret: SECRET,
    curriculumPack: fractionsPack,
  });
  const context = lessons.beginOrResume({
    phoneNumber: "+919999900001",
    learnerName: "Meena",
  });
  const guardian = new GuardianAccessService({
    repository,
    secret: SECRET,
    phoneHashSecret: SECRET,
    makeCode: () => "654321",
    clock: () => new Date("2026-07-18T12:00:00.000Z"),
  });
  const code = guardian.issue({
    learnerId: context.learner.id,
    guardianPhoneNumber: "+919999900001",
    smsAllowed: true,
    proactiveCallsAllowed: false,
  });
  let id = 0;
  const sms = new SmsControlService({
    repository,
    guardianAccess: guardian,
    defaultSubject: "Math",
    timeZone: "Asia/Kolkata",
    callbackSecret: SECRET,
    clock: () => new Date("2026-07-18T12:00:00.000Z"),
    makeId: () => `plan-${++id}`,
  });
  const payload = (messageSid: string, body: string) => ({
    MessageSid: messageSid,
    From: "+919999900001",
    To: "+14155550100",
    Body: body,
  });
  return { repository, context, guardian, code, sms, payload };
}

describe("signed SMS control surface", () => {
  it("activates and immediately stops a consented study plan", () => {
    const { repository, context, code, sms, payload } = setup();
    const started = sms.handle(
      payload(`SM${"a".repeat(32)}`, `START ${code}`),
    );
    expect(started.responseText).toContain("Calls active");
    expect(repository.findStudyPlan(context.learner.id)).toMatchObject({
      status: "active",
      guardianConsent: true,
      durationMinutes: 5,
      localStartTime: "19:00",
    });

    const stopped = sms.handle(
      payload(`SM${"b".repeat(32)}`, `STOP ${code}`),
    );
    expect(stopped.responseText).toContain("Future calls stopped");
    expect(repository.findStudyPlan(context.learner.id)).toMatchObject({
      status: "paused",
      nextScheduledCall: null,
    });
    expect(
      repository.findGuardianAuthorization(context.learner.id)
        ?.proactiveCallsAllowed,
    ).toBe(false);
    repository.close();
  });

  it("deduplicates MessageSid and requires two-step deletion", () => {
    const { repository, context, code, sms, payload } = setup();
    const firstPayload = payload(
      `SM${"c".repeat(32)}`,
      `DELETE ${code}`,
    );
    const requested = sms.handle(firstPayload);
    expect(requested.action).toBe("delete_requested");
    expect(sms.handle(firstPayload)).toEqual(requested);
    expect(repository.findLearner(context.learner.id)).toBeDefined();

    const deleted = sms.handle(
      payload(`SM${"d".repeat(32)}`, `DELETE ${code} CONFIRM`),
    );
    expect(deleted.action).toBe("deleted");
    expect(repository.findLearner(context.learner.id)).toBeUndefined();
    expect(repository.findStudyPlan(context.learner.id)).toBeUndefined();
    repository.close();
  });

  it("counts compact Unicode SMS segments honestly", () => {
    expect(smsSegmentInfo("Lesson paused at Q2.")).toEqual({
      encoding: "gsm7",
      segments: 1,
      characters: 20,
    });
    expect(smsSegmentInfo("पाठ कल फिर शुरू होगा।")).toMatchObject({
      encoding: "unicode",
      segments: 1,
    });
    expect(smsSegmentInfo("अ".repeat(80))).toMatchObject({
      encoding: "unicode",
      segments: 2,
    });
  });
});
