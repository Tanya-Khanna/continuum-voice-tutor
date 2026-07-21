import "dotenv/config";
import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalDashboardToken = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(24).optional(),
);

const booleanFromEnvironment = z.preprocess((value) => {
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const optionalPathArray = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.array(z.string().trim().min(1)).min(1).optional());

const stringArrayFromEnvironment = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
}, z.array(z.string().trim().min(1)).min(1).optional());

const EnvironmentSchema = z.object({
  TEACHING_ENGINE: z.enum(["offline", "openai"]).default("offline"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  NOMAD_DATABASE_PATH: z.string().min(1).default(".data/nomad.db"),
  NOMAD_PHONE_HASH_SECRET: z
    .string()
    .min(16)
    .default("local-development-change-me"),
  NOMAD_LEARNER_CODE_SECRET: z
    .string()
    .min(16)
    .default("local-learner-code-change-me"),
  NOMAD_GUARDIAN_CODE_SECRET: z
    .string()
    .min(16)
    .default("local-guardian-code-change-me"),
  NOMAD_CALLBACK_SECRET: z
    .string()
    .min(16)
    .default("local-callback-change-me"),
  NOMAD_PUBLIC_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  NOMAD_RELEASE_COMMIT: optionalNonEmpty,
  RAILWAY_GIT_COMMIT_SHA: optionalNonEmpty,
  NOMAD_PUBLIC_PHONE_ENABLED: booleanFromEnvironment,
  NOMAD_MISSED_CALL_ENABLED: booleanFromEnvironment,
  NOMAD_MISSED_CALL_ADULT_DEMO: booleanFromEnvironment,
  NOMAD_SMS_CONTROLS_ENABLED: booleanFromEnvironment,
  NOMAD_SMS_REMINDERS_ENABLED: booleanFromEnvironment,
  NOMAD_SMS_REMINDER_INTERVAL_MS: z.coerce.number().int().min(5_000).max(300_000).default(30_000),
  NOMAD_SCHEDULER_ENABLED: booleanFromEnvironment,
  NOMAD_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5_000).max(300_000).default(30_000),
  NOMAD_CALLBACK_ALLOWED_PREFIXES: stringArrayFromEnvironment.default([
    "+1",
    "+91",
  ]),
  NOMAD_DEPLOYMENT_TIME_ZONE: z.string().min(1).default("Asia/Kolkata"),
  NOMAD_CALLBACK_QUIET_START_HOUR: z.coerce.number().int().min(0).max(23).default(21),
  NOMAD_CALLBACK_QUIET_END_HOUR: z.coerce.number().int().min(0).max(23).default(7),
  NOMAD_CALLBACK_PER_NUMBER_DAILY_LIMIT: z.coerce.number().int().min(1).max(20).default(3),
  NOMAD_CALLBACK_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(1).max(10_000).default(100),
  NOMAD_CURRICULUM_PATH: optionalNonEmpty,
  NOMAD_CURRICULUM_PATHS: optionalPathArray,
  NOMAD_AGENT_EVAL_REPORT_PATH: z
    .string()
    .min(1)
    .default(".data/latest-agent-eval.json"),
  NOMAD_OPEN_TOPIC_LIVE_EVAL_REPORT_PATH: z
    .string()
    .min(1)
    .default(".data/latest-open-topic-live-eval.json"),
  NOMAD_DASHBOARD_TOKEN: optionalDashboardToken,
  NOMAD_MAX_CALLS_PER_HOUR: z.coerce.number().int().min(1).max(100).default(6),
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_TEXT_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  OPENAI_COMPILER_MODEL: z.string().min(1).default("gpt-5.6-terra"),
  OPENAI_VERIFIER_MODEL: z.string().min(1).default("gpt-5.6-terra"),
  OPENAI_REALTIME_MODEL: z
    .string()
    .min(1)
    .default("gpt-realtime-2.1-mini"),
  OPENAI_REALTIME_VOICE: z.string().min(1).default("marin"),
  OPENAI_REALTIME_SPEED: z.coerce.number().min(0.25).max(1.5).default(0.8),
  NOMAD_VAD_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  NOMAD_VAD_PREFIX_PADDING_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(1_000)
    .default(300),
  NOMAD_VAD_SILENCE_MS: z.coerce
    .number()
    .int()
    .min(200)
    .max(2_000)
    .default(650),
  OPENAI_SPEECH_MODEL: z.string().min(1).default("tts-1-hd"),
  OPENAI_WEBHOOK_SECRET: optionalNonEmpty,
  OPENAI_PROJECT_ID: optionalNonEmpty,
  NOMAD_OPENAI_WEBHOOK_PUBLIC: booleanFromEnvironment,
  TWILIO_ACCOUNT_SID: optionalNonEmpty,
  TWILIO_AUTH_TOKEN: optionalNonEmpty,
  TWILIO_PHONE_NUMBER: optionalNonEmpty,
  TWILIO_MISSED_CALL_NUMBER: optionalNonEmpty,
  NOMAD_TWILIO_SIP_TRUNK_CONFIGURED: booleanFromEnvironment,
  NOMAD_TWILIO_NUMBER_VOICE_READY: booleanFromEnvironment,
  NOMAD_SMS_RECAP_ENABLED: booleanFromEnvironment,
}).superRefine((environment, context) => {
  if (environment.NOMAD_CURRICULUM_PATH && environment.NOMAD_CURRICULUM_PATHS) {
    context.addIssue({
      code: "custom",
      path: ["NOMAD_CURRICULUM_PATHS"],
      message:
        "Configure NOMAD_CURRICULUM_PATH or NOMAD_CURRICULUM_PATHS, not both.",
    });
  }
  if (
    environment.NOMAD_MISSED_CALL_ENABLED &&
    (!environment.NOMAD_PUBLIC_BASE_URL ||
      !environment.TWILIO_ACCOUNT_SID ||
      !environment.TWILIO_AUTH_TOKEN ||
      !(environment.TWILIO_MISSED_CALL_NUMBER ?? environment.TWILIO_PHONE_NUMBER) ||
      !environment.OPENAI_PROJECT_ID)
  ) {
    context.addIssue({
      code: "custom",
      path: ["NOMAD_MISSED_CALL_ENABLED"],
      message:
        "Missed-call callbacks require NOMAD_PUBLIC_BASE_URL, Twilio credentials and number, and OPENAI_PROJECT_ID.",
    });
  }
  if (
    environment.NOMAD_SMS_CONTROLS_ENABLED &&
    (!environment.NOMAD_PUBLIC_BASE_URL ||
      !environment.TWILIO_ACCOUNT_SID ||
      !environment.TWILIO_AUTH_TOKEN ||
      !environment.TWILIO_PHONE_NUMBER)
  ) {
    context.addIssue({
      code: "custom",
      path: ["NOMAD_SMS_CONTROLS_ENABLED"],
      message:
        "SMS controls require NOMAD_PUBLIC_BASE_URL and Twilio credentials and phone number.",
    });
  }
  if (
    environment.NOMAD_SMS_REMINDERS_ENABLED &&
    (!environment.NOMAD_PUBLIC_BASE_URL ||
      !environment.TWILIO_ACCOUNT_SID ||
      !environment.TWILIO_AUTH_TOKEN ||
      !environment.TWILIO_PHONE_NUMBER)
  ) {
    context.addIssue({
      code: "custom",
      path: ["NOMAD_SMS_REMINDERS_ENABLED"],
      message:
        "SMS reminders require NOMAD_PUBLIC_BASE_URL and Twilio credentials and phone number.",
    });
  }
  if (
    environment.NOMAD_SCHEDULER_ENABLED &&
    (!environment.NOMAD_PUBLIC_BASE_URL ||
      !environment.TWILIO_ACCOUNT_SID ||
      !environment.TWILIO_AUTH_TOKEN ||
      !environment.TWILIO_PHONE_NUMBER ||
      !environment.OPENAI_PROJECT_ID)
  ) {
    context.addIssue({
      code: "custom",
      path: ["NOMAD_SCHEDULER_ENABLED"],
      message:
        "The scheduler requires NOMAD_PUBLIC_BASE_URL, Twilio credentials and phone number, plus OPENAI_PROJECT_ID.",
    });
  }
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  return EnvironmentSchema.parse(source);
}

export function requireOpenAIKey(environment: Environment): string {
  if (!environment.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required for live mode. Keep TEACHING_ENGINE=offline until API credits are available.",
    );
  }
  return environment.OPENAI_API_KEY;
}
