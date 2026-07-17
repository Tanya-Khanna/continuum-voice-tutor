import { describe, expect, it } from "vitest";
import { loadEnvironment, requireOpenAIKey } from "../src/config/env.js";

describe("environment configuration", () => {
  it("defaults to a credential-free offline mode", () => {
    const environment = loadEnvironment({});
    expect(environment.TEACHING_ENGINE).toBe("offline");
    expect(environment.OPENAI_TEXT_MODEL).toBe("gpt-5.6-luna");
    expect(environment.OPENAI_COMPILER_MODEL).toBe("gpt-5.6-terra");
    expect(environment.OPENAI_VERIFIER_MODEL).toBe("gpt-5.6-terra");
    expect(environment.OPENAI_REALTIME_MODEL).toBe(
      "gpt-realtime-2.1-mini",
    );
    expect(environment.OPENAI_REALTIME_VOICE).toBe("marin");
    expect(environment.NOMAD_MAX_CALLS_PER_HOUR).toBe(6);
    expect(environment.NOMAD_SMS_RECAP_ENABLED).toBe(false);
  });

  it("parses an explicit SMS recap opt-in without treating false as truthy", () => {
    expect(
      loadEnvironment({ NOMAD_SMS_RECAP_ENABLED: "true" })
        .NOMAD_SMS_RECAP_ENABLED,
    ).toBe(true);
    expect(
      loadEnvironment({ NOMAD_SMS_RECAP_ENABLED: "false" })
        .NOMAD_SMS_RECAP_ENABLED,
    ).toBe(false);
  });

  it("prevents accidental live mode without a key", () => {
    const environment = loadEnvironment({ TEACHING_ENGINE: "openai" });
    expect(() => requireOpenAIKey(environment)).toThrow(/offline/);
  });
});
