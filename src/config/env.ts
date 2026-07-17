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

const EnvironmentSchema = z.object({
  TEACHING_ENGINE: z.enum(["offline", "openai"]).default("offline"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  NOMAD_DATABASE_PATH: z.string().min(1).default(".data/nomad.db"),
  NOMAD_PHONE_HASH_SECRET: z
    .string()
    .min(16)
    .default("local-development-change-me"),
  NOMAD_CURRICULUM_PATH: optionalNonEmpty,
  NOMAD_CURRICULUM_PATHS: optionalPathArray,
  NOMAD_AGENT_EVAL_REPORT_PATH: z
    .string()
    .min(1)
    .default(".data/latest-agent-eval.json"),
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
