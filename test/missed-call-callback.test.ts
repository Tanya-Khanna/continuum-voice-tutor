import { describe, expect, it, vi } from "vitest";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import {
  MISSED_CALL_REJECT_TWIML,
  MissedCallCallbackService,
  buildCallbackSipUri,
  placeTwilioCallback,
} from "../src/telephony/missed-call-callback.js";
import {
  accessModeFromIncomingCall,
  callerNumberFromIncomingCall,
  durationFromIncomingCall,
  learnerIdFromIncomingCall,
} from "../src/telephony/realtime-sip.js";
import {
  computeTwilioSignature,
  validateTwilioSignature,
} from "../src/telephony/twilio-signature.js";
import { hashPhoneNumber } from "../src/domain/identity.js";
import { LearnerProfileSchema } from "../src/domain/learner.js";

const SECRET = "callback-test-secret-12345";
const ACCOUNT_SID = `AC${"a".repeat(32)}`;
const CALL_SID = `CA${"b".repeat(32)}`;

function service(repository: SqliteLearningRepository) {
  let id = 0;
  return new MissedCallCallbackService({
    repository,
    secret: SECRET,
    phoneHashSecret: "phone-hash-test-secret",
    allowedPrefixes: ["+91"],
    timeZone: "Asia/Kolkata",
    quietStartHour: 21,
    quietEndHour: 7,
    perNumberDailyLimit: 3,
    globalDailyLimit: 100,
    allowAdultDemo: true,
    clock: () => new Date("2026-07-18T12:00:00.000Z"),
    makeId: () => `callback-${++id}`,
  });
}

describe("missed-call callback access", () => {
  it("uses Reject as the first TwiML verb", () => {
    expect(MISSED_CALL_REJECT_TWIML).toMatch(
      /^<\?xml[^>]*><Response><Reject reason="busy"\/><\/Response>$/u,
    );
  });

  it("validates Twilio form signatures", () => {
    const parameters = new URLSearchParams({
      CallSid: CALL_SID,
      From: "+919999900001",
      To: "+14155550100",
    });
    const options = {
      authToken: "twilio-auth-token",
      url: "https://continuum.example/webhooks/twilio/missed-call",
      parameters,
    };
    const signature = computeTwilioSignature(options);
    expect(
      validateTwilioSignature({ ...options, providedSignature: signature }),
    ).toBe(true);
    expect(
      validateTwilioSignature({ ...options, providedSignature: "tampered" }),
    ).toBe(false);

    const signatureWithStandardPort = computeTwilioSignature({
      ...options,
      url: "https://continuum.example:443/webhooks/twilio/missed-call",
    });
    expect(
      validateTwilioSignature({
        ...options,
        providedSignature: signatureWithStandardPort,
      }),
    ).toBe(true);
  });

  it("encrypts the destination and collapses duplicate missed calls", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const callbacks = service(repository);
    const first = callbacks.enqueue({
      CallSid: CALL_SID,
      From: "+919999900001",
      To: "+14155550100",
      CallStatus: "ringing",
    });
    expect(first.status).toBe("queued");
    if (first.status !== "queued") throw new Error("Expected queued callback");
    expect(JSON.stringify(first.job)).not.toContain("+919999900001");
    expect(callbacks.destination(first.job)).toBe("+919999900001");

    const duplicate = callbacks.enqueue({
      CallSid: `CA${"c".repeat(32)}`,
      From: "+919999900001",
      To: "+14155550100",
      CallStatus: "ringing",
    });
    expect(duplicate).toMatchObject({
      status: "duplicate",
      job: { id: first.job.id },
    });
    repository.close();
  });

  it("lets an unregistered adult demo caller test outside learner quiet hours", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const callbacks = new MissedCallCallbackService({
      repository,
      secret: SECRET,
      phoneHashSecret: "phone-hash-test-secret",
      allowedPrefixes: ["+91"],
      timeZone: "Asia/Kolkata",
      quietStartHour: 21,
      quietEndHour: 7,
      perNumberDailyLimit: 3,
      globalDailyLimit: 100,
      allowAdultDemo: true,
      clock: () => new Date("2026-07-18T17:00:00.000Z"),
      makeId: () => "adult-demo-callback",
    });

    expect(
      callbacks.enqueue({
        CallSid: `CA${"d".repeat(32)}`,
        From: "+919999900002",
        To: "+14155550100",
        CallStatus: "ringing",
      }),
    ).toMatchObject({ status: "queued" });
    repository.close();
  });

  it("blocks an enrolled learner during quiet hours outside adult demo mode", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const phoneHashSecret = "phone-hash-test-secret";
    repository.saveLearner(
      LearnerProfileSchema.parse({
        id: "quiet-hours-learner",
        name: "Synthetic learner",
        phoneHash: hashPhoneNumber("+919999900003", phoneHashSecret),
        preferredLanguage: "en",
        currentConcept: "fractions",
        lastMastery: "needs_support",
        createdAt: "2026-07-18T12:00:00.000Z",
        updatedAt: "2026-07-18T12:00:00.000Z",
      }),
    );
    const callbacks = new MissedCallCallbackService({
      repository,
      secret: SECRET,
      phoneHashSecret,
      allowedPrefixes: ["+91"],
      timeZone: "Asia/Kolkata",
      quietStartHour: 21,
      quietEndHour: 7,
      perNumberDailyLimit: 3,
      globalDailyLimit: 100,
      allowAdultDemo: false,
      clock: () => new Date("2026-07-18T17:00:00.000Z"),
      makeId: () => "learner-callback",
    });

    expect(
      callbacks.enqueue({
        CallSid: `CA${"e".repeat(32)}`,
        From: "+919999900003",
        To: "+14155550100",
        CallStatus: "ringing",
      }),
    ).toEqual({ status: "blocked", reason: "quiet_hours" });
    repository.close();
  });

  it("places the outbound call with a signed original-caller SIP header", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ sid: CALL_SID, status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await placeTwilioCallback({
      accountSid: ACCOUNT_SID,
      authToken: "token",
      from: "+14155550100",
      to: "+919999900001",
      projectId: "proj_example",
      relaySecret: SECRET,
      learnerId: "learner_1",
      durationMinutes: 10,
      accessMode: "scheduled",
      statusCallbackUrl:
        "https://continuum.example/webhooks/twilio/call-status?receipt_id=receipt-1",
      fetchImplementation,
    });
    const body = new URLSearchParams(
      fetchImplementation.mock.calls[0]![1]!.body as string,
    );
    const twiml = body.get("Twiml")!;
    expect(twiml).toContain("<Dial answerOnBridge=\"true\">");
    expect(twiml).toContain("X-Continuum-Caller");
    expect(body.get("StatusCallbackEvent")).toBe(
      "initiated ringing answered completed",
    );

    const uri = buildCallbackSipUri({
      projectId: "proj_example",
      callerNumber: "+919999900001",
      relaySecret: SECRET,
      learnerId: "learner_1",
      durationMinutes: 10,
      accessMode: "scheduled",
    });
    const query = new URLSearchParams(uri.split("?")[1]);
    const event = {
      id: "evt_1",
      type: "realtime.call.incoming",
      data: {
        call_id: "call_1",
        sip_headers: [
          { name: "From", value: "<sip:+14155550100@example.com>" },
          { name: "X-Continuum-Caller", value: query.get("X-Continuum-Caller") },
          {
            name: "X-Continuum-Signature",
            value: query.get("X-Continuum-Signature"),
          },
          {
            name: "X-Continuum-Learner-Id",
            value: query.get("X-Continuum-Learner-Id"),
          },
          {
            name: "X-Continuum-Duration-Minutes",
            value: query.get("X-Continuum-Duration-Minutes"),
          },
          {
            name: "X-Continuum-Access-Mode",
            value: query.get("X-Continuum-Access-Mode"),
          },
        ],
      },
    };
    expect(callerNumberFromIncomingCall(event, SECRET)).toBe(
      "+919999900001",
    );
    expect(learnerIdFromIncomingCall(event, SECRET)).toBe("learner_1");
    expect(durationFromIncomingCall(event, SECRET)).toBe(10);
    expect(accessModeFromIncomingCall(event, SECRET)).toBe("scheduled");
    const tamperedEvent = structuredClone(event);
    const modeHeader = tamperedEvent.data.sip_headers.find(
      (header) => header.name === "X-Continuum-Access-Mode",
    );
    modeHeader!.value = "missed_call";
    expect(callerNumberFromIncomingCall(tamperedEvent, SECRET)).toBe(
      "+14155550100",
    );
    expect(accessModeFromIncomingCall(tamperedEvent, SECRET)).toBe("unknown");
    expect(callerNumberFromIncomingCall(event, "wrong-secret-value")).toBe(
      "+14155550100",
    );
  });
});
