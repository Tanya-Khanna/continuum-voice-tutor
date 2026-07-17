import "dotenv/config";
import { z } from "zod";

const optionalCredential = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const EnvironmentSchema = z.object({
  TEACHING_ENGINE: z.enum(["offline", "openai"]).default("offline"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  OPENAI_API_KEY: optionalCredential,
  OPENAI_TEXT_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  OPENAI_REALTIME_MODEL: z.string().min(1).default("gpt-realtime-2.1"),
  OPENAI_WEBHOOK_SECRET: optionalCredential,
  OPENAI_PROJECT_ID: optionalCredential,
  TWILIO_ACCOUNT_SID: optionalCredential,
  TWILIO_AUTH_TOKEN: optionalCredential,
  TWILIO_PHONE_NUMBER: optionalCredential,
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
