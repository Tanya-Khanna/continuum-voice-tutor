import "dotenv/config";
import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const booleanFromEnvironment = z.preprocess((value) => {
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const EnvironmentSchema = z.object({
  TEACHING_ENGINE: z.enum(["offline", "openai"]).default("offline"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  NOMAD_DATABASE_PATH: z.string().min(1).default(".data/nomad.db"),
  NOMAD_PHONE_HASH_SECRET: z
    .string()
    .min(16)
    .default("local-development-change-me"),
  NOMAD_CURRICULUM_PATH: optionalNonEmpty,
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
  OPENAI_SPEECH_MODEL: z.string().min(1).default("tts-1-hd"),
  OPENAI_WEBHOOK_SECRET: optionalNonEmpty,
  OPENAI_PROJECT_ID: optionalNonEmpty,
  TWILIO_ACCOUNT_SID: optionalNonEmpty,
  TWILIO_AUTH_TOKEN: optionalNonEmpty,
  TWILIO_PHONE_NUMBER: optionalNonEmpty,
  NOMAD_SMS_RECAP_ENABLED: booleanFromEnvironment,
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
