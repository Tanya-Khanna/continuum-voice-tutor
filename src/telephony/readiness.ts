import { z } from "zod";
import type { Environment } from "../config/env.js";

const PhoneReadinessCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ready: z.boolean(),
  nextAction: z.string().min(1),
});

export const PhoneReadinessReportSchema = z.object({
  ready: z.boolean(),
  smokeTestReady: z.boolean(),
  readyCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  guidePath: z.literal("docs/PHONE_SETUP.md"),
  checks: z.array(PhoneReadinessCheckSchema).min(1),
});

export type PhoneReadinessReport = z.infer<
  typeof PhoneReadinessReportSchema
>;

const openAIProjectIdPattern = /^proj_[A-Za-z0-9_-]+$/u;
const twilioAccountSidPattern = /^AC[0-9a-f]{32}$/iu;
const e164PhoneNumberPattern = /^\+[1-9][0-9]{7,14}$/u;

export function buildPhoneReadinessReport(
  environment: Environment,
): PhoneReadinessReport {
  const checks = [
    {
      id: "live_teaching_engine",
      label: "Live GPT-5.6 teaching engine selected",
      ready: environment.TEACHING_ENGINE === "openai",
      nextAction: "Set TEACHING_ENGINE=openai for the real call.",
    },
    {
      id: "openai_api_key",
      label: "OpenAI API key present",
      ready: Boolean(environment.OPENAI_API_KEY),
      nextAction: "Save the restricted project key as OPENAI_API_KEY.",
    },
    {
      id: "openai_project_id",
      label: "OpenAI project ID has the documented proj_ shape",
      ready: openAIProjectIdPattern.test(environment.OPENAI_PROJECT_ID ?? ""),
      nextAction:
        "Copy the proj_ ID from OpenAI Project > General; see docs/PHONE_SETUP.md.",
    },
    {
      id: "openai_webhook_secret",
      label: "OpenAI webhook secret present",
      ready: Boolean(environment.OPENAI_WEBHOOK_SECRET),
      nextAction:
        "Create the realtime.call.incoming webhook and save its signing secret; see docs/PHONE_SETUP.md.",
    },
    {
      id: "public_signed_webhook",
      label: "Signed webhook reachable over public HTTPS",
      ready: environment.NOMAD_OPENAI_WEBHOOK_PUBLIC,
      nextAction:
        "Make one controlled smoke call, confirm a valid signed delivery, then set NOMAD_OPENAI_WEBHOOK_PUBLIC=true.",
    },
    {
      id: "phone_hash_secret",
      label: "Deployment phone hash secret changed",
      ready:
        environment.NOMAD_PHONE_HASH_SECRET !==
        "local-development-change-me",
      nextAction:
        "Replace NOMAD_PHONE_HASH_SECRET with a random deployment secret of at least 16 characters.",
    },
    {
      id: "dashboard_access_token",
      label: "Mission Control learner sessions access-protected",
      ready: Boolean(environment.NOMAD_DASHBOARD_TOKEN),
      nextAction:
        "Set a random NOMAD_DASHBOARD_TOKEN of at least 24 characters before exposing the server.",
    },
    {
      id: "twilio_credentials",
      label: "Twilio Account SID shape and auth token present",
      ready:
        twilioAccountSidPattern.test(environment.TWILIO_ACCOUNT_SID ?? "") &&
        Boolean(environment.TWILIO_AUTH_TOKEN),
      nextAction:
        "Save the AC... Account SID and auth token after onboarding; see docs/PHONE_SETUP.md.",
    },
    {
      id: "twilio_phone_number",
      label: "Twilio voice number has E.164 shape",
      ready: e164PhoneNumberPattern.test(environment.TWILIO_PHONE_NUMBER ?? ""),
      nextAction:
        "Purchase or assign a voice-capable number and save it as +<country><number>; see docs/PHONE_SETUP.md.",
    },
    {
      id: "twilio_voice_ready",
      label: "Twilio number voice routing verified",
      ready: environment.NOMAD_TWILIO_NUMBER_VOICE_READY,
      nextAction:
        "Verify the number can receive the intended call, then set NOMAD_TWILIO_NUMBER_VOICE_READY=true.",
    },
    {
      id: "twilio_sip_trunk",
      label: "Twilio SIP trunk routes to OpenAI",
      ready: environment.NOMAD_TWILIO_SIP_TRUNK_CONFIGURED,
      nextAction:
        "Route the Twilio trunk to sip:<project-id>@sip.api.openai.com;transport=tls, test it, then set NOMAD_TWILIO_SIP_TRUNK_CONFIGURED=true.",
    },
  ].map((check) => PhoneReadinessCheckSchema.parse(check));
  const readyCount = checks.filter((check) => check.ready).length;
  // A valid signed delivery cannot be observed until the first inbound SIP call.
  // Permit only that single evidence-gathering call when every other gate passes.
  const smokeTestReady = checks.every(
    (check) => check.ready || check.id === "public_signed_webhook",
  );
  return PhoneReadinessReportSchema.parse({
    ready: readyCount === checks.length,
    smokeTestReady,
    readyCount,
    totalCount: checks.length,
    guidePath: "docs/PHONE_SETUP.md",
    checks,
  });
}
