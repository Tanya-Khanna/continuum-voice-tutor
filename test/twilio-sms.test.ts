import { describe, expect, it, vi } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import {
  resolveTwilioSmsConfig,
  sendTwilioSms,
} from "../src/messaging/twilio-sms.js";

const ACCOUNT_SID = `AC${"a".repeat(32)}`;

describe("Twilio SMS recap boundary", () => {
  it("stays disabled by default and fails closed when enabled without credentials", () => {
    expect(resolveTwilioSmsConfig(loadEnvironment({}))).toBeUndefined();
    expect(() =>
      resolveTwilioSmsConfig(
        loadEnvironment({ NOMAD_SMS_RECAP_ENABLED: "true" }),
      ),
    ).toThrow(/requires TWILIO/);
  });

  it("creates a form-encoded Message with HTTP Basic authentication", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ sid: "SM123", status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      sendTwilioSms({
        accountSid: ACCOUNT_SID,
        authToken: "secret-token",
        from: "+14155550100",
        to: "+919999900001",
        body: "Resumen listo. ¿Qué idea recordarás mañana?",
        statusCallbackUrl: "https://continuum.example/webhooks/twilio/message-status",
        fetchImplementation,
      }),
    ).resolves.toEqual({ sid: "SM123", status: "queued", segments: 1 });

    const [url, request] = fetchImplementation.mock.calls[0]!;
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    );
    expect(request).toMatchObject({ method: "POST" });
    expect(new URLSearchParams(request!.body as string)).toEqual(
      new URLSearchParams({
        To: "+919999900001",
        From: "+14155550100",
        Body: "Resumen listo. ¿Qué idea recordarás mañana?",
        StatusCallback:
          "https://continuum.example/webhooks/twilio/message-status",
      }),
    );
    expect(new Headers(request!.headers).get("Authorization")).toBe(
      `Basic ${Buffer.from(`${ACCOUNT_SID}:secret-token`).toString("base64")}`,
    );
  });

  it("reports only a status when Twilio rejects the request", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("credential detail", { status: 401 }));
    await expect(
      sendTwilioSms({
        accountSid: ACCOUNT_SID,
        authToken: "do-not-leak",
        from: "+14155550100",
        to: "+919999900001",
        body: "Recap",
        fetchImplementation,
      }),
    ).rejects.toThrow("status 401");
    await expect(
      sendTwilioSms({
        accountSid: ACCOUNT_SID,
        authToken: "do-not-leak",
        from: "+14155550100",
        to: "+919999900001",
        body: "Recap",
        fetchImplementation,
      }),
    ).rejects.not.toThrow(/do-not-leak|credential detail/);
  });
});
