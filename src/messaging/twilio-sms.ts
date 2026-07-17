import { z } from "zod";
import type { Environment } from "../config/env.js";

const E164PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/u, "Expected an E.164 phone number.");

const TwilioSmsRequestSchema = z.object({
  accountSid: z.string().regex(/^AC[0-9a-fA-F]{32}$/u),
  authToken: z.string().min(1),
  from: E164PhoneNumberSchema,
  to: E164PhoneNumberSchema,
  body: z.string().trim().min(1).max(1_600),
});

const TwilioMessageResponseSchema = z
  .object({
    sid: z.string().min(1),
    status: z.string().min(1),
  })
  .passthrough();

export type TwilioSmsConfig = Pick<
  z.infer<typeof TwilioSmsRequestSchema>,
  "accountSid" | "authToken" | "from"
>;

export function resolveTwilioSmsConfig(
  environment: Environment,
): TwilioSmsConfig | undefined {
  if (!environment.NOMAD_SMS_RECAP_ENABLED) return undefined;
  if (
    !environment.TWILIO_ACCOUNT_SID ||
    !environment.TWILIO_AUTH_TOKEN ||
    !environment.TWILIO_PHONE_NUMBER
  ) {
    throw new Error(
      "NOMAD_SMS_RECAP_ENABLED requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    );
  }
  return TwilioSmsRequestSchema.pick({
    accountSid: true,
    authToken: true,
    from: true,
  }).parse({
    accountSid: environment.TWILIO_ACCOUNT_SID,
    authToken: environment.TWILIO_AUTH_TOKEN,
    from: environment.TWILIO_PHONE_NUMBER,
  });
}

export async function sendTwilioSms(options: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
  fetchImplementation?: typeof fetch;
}): Promise<{ sid: string; status: string }> {
  const parsed = TwilioSmsRequestSchema.parse(options);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const form = new URLSearchParams({
    To: parsed.to,
    From: parsed.from,
    Body: parsed.body,
  });
  const response = await fetchImplementation(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(parsed.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${parsed.accountSid}:${parsed.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Twilio message creation failed with status ${response.status}.`);
  }
  return TwilioMessageResponseSchema.parse(await response.json());
}
