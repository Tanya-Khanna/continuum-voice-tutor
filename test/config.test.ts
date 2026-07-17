import { describe, expect, it } from "vitest";
import { loadEnvironment, requireOpenAIKey } from "../src/config/env.js";

describe("environment configuration", () => {
  it("defaults to a credential-free offline mode", () => {
    const environment = loadEnvironment({});
    expect(environment.TEACHING_ENGINE).toBe("offline");
    expect(environment.OPENAI_TEXT_MODEL).toBe("gpt-5.6-luna");
    expect(environment.OPENAI_REALTIME_MODEL).toBe(
      "gpt-realtime-2.1-mini",
    );
    expect(environment.OPENAI_REALTIME_VOICE).toBe("marin");
    expect(environment.NOMAD_MAX_CALLS_PER_HOUR).toBe(6);
  });

  it("prevents accidental live mode without a key", () => {
    const environment = loadEnvironment({ TEACHING_ENGINE: "openai" });
    expect(() => requireOpenAIKey(environment)).toThrow(/offline/);
  });
});
