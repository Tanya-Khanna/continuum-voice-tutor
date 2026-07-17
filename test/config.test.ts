import { describe, expect, it } from "vitest";
import { loadEnvironment, requireOpenAIKey } from "../src/config/env.js";

describe("environment configuration", () => {
  it("defaults to a credential-free offline mode", () => {
    const environment = loadEnvironment({});
    expect(environment.TEACHING_ENGINE).toBe("offline");
    expect(environment.OPENAI_TEXT_MODEL).toBe("gpt-5.6-luna");
  });

  it("prevents accidental live mode without a key", () => {
    const environment = loadEnvironment({ TEACHING_ENGINE: "openai" });
    expect(() => requireOpenAIKey(environment)).toThrow(/offline/);
  });
});
