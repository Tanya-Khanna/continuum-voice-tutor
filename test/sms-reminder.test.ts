import { describe, expect, it } from "vitest";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { GuardianAccessService } from "../src/guardian/guardian-access-service.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { OpenTopicSmsService } from "../src/messaging/open-topic-sms-service.js";
import { SmsReminderService } from "../src/messaging/sms-reminder-service.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { smsSegmentInfo } from "../src/domain/sms-control.js";

const SECRET = "sms-reminder-test-secret";
const PHONE = "+919999900001";
const OTHER_PHONE = "+919999900002";

function payload(id: string, body: string) {
  return {
    MessageSid: `SM${id.repeat(32).slice(0, 32)}`,
    From: PHONE,
    To: "+14155550100",
    Body: body,
  };
}

function fixture(start = "2026-07-21T12:00:00.000Z") {
  let now = new Date(start);
  let id = 0;
  const clock = () => now;
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
  const guardian = new GuardianAccessService({
    repository,
    secret: SECRET,
    phoneHashSecret: SECRET,
    clock,
    makeCode: () => "654321",
  });
  const code = guardian.issue({
    learnerId: learner.id,
    guardianPhoneNumber: PHONE,
    smsAllowed: true,
    proactiveCallsAllowed: false,
  });
  const reminders = new SmsReminderService({
    repository,
    phoneHashSecret: SECRET,
    encryptionSecret: SECRET,
    timeZone: "UTC",
    quietStartHour: 21,
    quietEndHour: 7,
    clock,
    makeId: () => `reminder-${++id}`,
  });
  return {
    repository,
    learner,
    guardian,
    code,
    reminders,
    setNow(value: string) {
      now = new Date(value);
    },
  };
}

describe("consented one-time SMS reminders", () => {
  it("requires explicit consent and authorization for the exact phone", () => {
    const { repository, learner, reminders } = fixture();
    const request = {
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "fractions",
      dueAt: "2026-07-22T12:00:00.000Z",
      examAt: "2026-07-24T12:00:00.000Z",
    };
    expect(() =>
      reminders.scheduleExamReview({ ...request, consentConfirmed: false }),
    ).toThrow("explicit consent");
    expect(() =>
      reminders.scheduleExamReview({
        ...request,
        recipientPhoneNumber: OTHER_PHONE,
        consentConfirmed: true,
      }),
    ).toThrow("does not have SMS authorization");
    expect(repository.listSmsReminders(learner.id)).toHaveLength(0);
    repository.close();
  });

  it("fits Unicode topics into one segment, redacts PII, and deduplicates", () => {
    const { repository, learner, reminders } = fixture();
    const request = {
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic:
        "भिन्न और दशमलव with meena@example.com and a deliberately long revision description",
      dueAt: "2026-07-22T12:00:00.000Z",
      examAt: "2026-07-24T12:00:00.000Z",
      consentConfirmed: true,
    };
    const first = reminders.scheduleExamReview(request);
    const second = reminders.scheduleExamReview(request);
    expect(second.id).toBe(first.id);
    expect(first.message).not.toContain("meena@example.com");
    expect(smsSegmentInfo(first.message)).toMatchObject({ segments: 1 });
    expect(
      repository.findGuardianAuthorization(learner.id)?.proactiveCallsAllowed,
    ).toBe(true);
    repository.close();
  });

  it("defers during quiet hours, sends once afterward, and records the provider SID", async () => {
    const { repository, learner, reminders, setNow } = fixture(
      "2026-07-21T20:00:00.000Z",
    );
    const reminder = reminders.scheduleExamReview({
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "photosynthesis",
      dueAt: "2026-07-21T21:00:00.000Z",
      examAt: "2026-07-23T12:00:00.000Z",
      consentConfirmed: true,
    });
    const sent: { to: string; body: string }[] = [];
    setNow("2026-07-21T22:00:00.000Z");
    expect(
      await reminders.runDue(async (message) => {
        sent.push(message);
        return { sid: "SMsent" };
      }),
    ).toMatchObject({ deferred: 1, sent: 0 });
    expect(sent).toHaveLength(0);
    const deferred = repository.findSmsReminder(reminder.id)!;
    expect(deferred.status).toBe("pending");

    setNow("2026-07-22T07:15:00.000Z");
    expect(
      await reminders.runDue(async (message) => {
        sent.push(message);
        return { sid: "SMsent" };
      }),
    ).toMatchObject({ sent: 1 });
    expect(sent).toEqual([{ to: PHONE, body: deferred.message }]);
    expect(repository.findSmsReminder(reminder.id)).toMatchObject({
      status: "sent",
      providerMessageSid: "SMsent",
    });
    expect(await reminders.runDue(async () => undefined)).toMatchObject({ sent: 0 });
    repository.close();
  });

  it("cancels before delivery when consent is revoked", async () => {
    const { repository, learner, reminders, setNow } = fixture();
    const reminder = reminders.scheduleExamReview({
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "algebra",
      dueAt: "2026-07-21T13:00:00.000Z",
      examAt: "2026-07-23T12:00:00.000Z",
      consentConfirmed: true,
    });
    const authorization = repository.findGuardianAuthorization(learner.id)!;
    repository.saveGuardianAuthorization({
      ...authorization,
      proactiveCallsAllowed: false,
      updatedAt: "2026-07-21T12:30:00.000Z",
    });
    setNow("2026-07-21T13:05:00.000Z");
    let sends = 0;
    expect(
      await reminders.runDue(async () => {
        sends += 1;
      }),
    ).toMatchObject({ cancelled: 1, sent: 0 });
    expect(sends).toBe(0);
    expect(repository.findSmsReminder(reminder.id)?.status).toBe("cancelled");
    repository.close();
  });

  it("makes STOP cancel pending reminders immediately", () => {
    const { repository, learner, guardian, code, reminders } = fixture();
    reminders.scheduleExamReview({
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "geography",
      dueAt: "2026-07-22T12:00:00.000Z",
      examAt: "2026-07-24T12:00:00.000Z",
      consentConfirmed: true,
    });
    const sms = new OpenTopicSmsService({
      repository,
      guardianAccess: guardian,
      reminderService: reminders,
    });
    expect(sms.handle(payload("f", `STOP ${code}`)).action).toBe("stop");
    expect(repository.listSmsReminders(learner.id)[0]?.status).toBe("cancelled");
    repository.close();
  });

  it("schedules a separate one-time callback nudge without creating a call job", async () => {
    const { repository, learner, reminders, setNow } = fixture();
    const first = reminders.scheduleCallbackNudge({
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "continue the moon lesson",
      dueAt: "2026-07-21T13:00:00.000Z",
      consentConfirmed: true,
    });
    const duplicate = reminders.scheduleCallbackNudge({
      learnerId: learner.id,
      recipientPhoneNumber: PHONE,
      topic: "continue the moon lesson",
      dueAt: "2026-07-21T13:00:00.000Z",
      consentConfirmed: true,
    });
    expect(duplicate.id).toBe(first.id);
    expect(first.kind).toBe("callback_nudge");
    expect(first.message).toContain("Call Continuum");
    expect(smsSegmentInfo(first.message).segments).toBe(1);
    setNow("2026-07-21T13:05:00.000Z");
    const sent: string[] = [];
    expect(
      await reminders.runDue(async ({ body }) => {
        sent.push(body);
      }),
    ).toMatchObject({ sent: 1 });
    expect(sent).toEqual([first.message]);
    expect(repository.listRecentLessons(10)).toHaveLength(0);
    repository.close();
  });
});
