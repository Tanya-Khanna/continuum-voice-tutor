import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { GuardianAccessService } from "../src/guardian/guardian-access-service.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { HomeworkService } from "../src/messaging/homework-service.js";
import { SmsControlService } from "../src/messaging/sms-control-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "homework-test-secret-12345";

describe("feature-phone homework", () => {
  it("sends one reviewed SMS segment and idempotently records the correct learner reply", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const lessons = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = lessons.beginOrResume({
      phoneNumber: "+919999900020",
      learnerName: "Meena",
    });
    const homework = new HomeworkService({
      repository,
      phoneHashSecret: SECRET,
      makeCode: () => "ABC123",
      makeId: (() => {
        let id = 0;
        return () => `homework-id-${++id}`;
      })(),
      clock: () => new Date("2026-07-18T12:00:00.000Z"),
    });
    const assigned = homework.assign({
      learnerId: context.learner.id,
      sessionId: context.session.id,
      recipientPhoneNumber: "+919999900020",
      draft: lessons.homeworkDraft(context),
    });
    expect(assigned.smsText).toContain("Reply HW ABC123 1-4");
    expect(assigned.smsText.length).toBeLessThanOrEqual(160);

    const guardian = new GuardianAccessService({
      repository,
      secret: SECRET,
      phoneHashSecret: SECRET,
    });
    const sms = new SmsControlService({
      repository,
      guardianAccess: guardian,
      homeworkService: homework,
      defaultSubject: "Math",
      timeZone: "Asia/Kolkata",
      callbackSecret: SECRET,
    });
    const payload = {
      MessageSid: `SM${"e".repeat(32)}`,
      From: "+919999900020",
      To: "+14155550100",
      Body: "HW ABC123 1",
    };
    const receipt = sms.handle(payload);
    expect(receipt).toMatchObject({
      learnerId: context.learner.id,
      action: "homework",
    });
    expect(receipt.responseText).toContain("correct");
    expect(sms.handle(payload)).toEqual(receipt);
    expect(repository.findHomeworkAssignmentByCode("ABC123")).toMatchObject({
      status: "correct",
      submittedKey: "1",
    });
    expect(
      repository
        .listLearningEvidence(context.learner.id)
        .filter((evidence) => evidence.kind === "homework"),
    ).toHaveLength(1);
    repository.close();
  });

  it("rejects a homework code used from a different phone", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const lessons = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: SECRET,
      curriculumPack: fractionsPack,
    });
    const context = lessons.beginOrResume({
      phoneNumber: "+919999900021",
      learnerName: "Meena",
    });
    const homework = new HomeworkService({
      repository,
      phoneHashSecret: SECRET,
      makeCode: () => "XYZ789",
    });
    homework.assign({
      learnerId: context.learner.id,
      sessionId: context.session.id,
      recipientPhoneNumber: "+919999900021",
      draft: lessons.homeworkDraft(context),
    });
    expect(() =>
      homework.submit({
        reply: { code: "XYZ789", answer: "1" },
        sourcePhoneNumber: "+919999900022",
      }),
    ).toThrow(/not recognized/u);
    repository.close();
  });
});
