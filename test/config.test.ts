import { describe, expect, it } from "vitest";
import { loadEnvironment, requireOpenAIKey } from "../src/config/env.js";

describe("environment configuration", () => {
  it("defaults to a credential-free offline mode", () => {
    const environment = loadEnvironment({});
    expect(environment.TEACHING_ENGINE).toBe("offline");
    expect(environment.HOST).toBe("0.0.0.0");
    expect(environment.OPENAI_TEXT_MODEL).toBe("gpt-5.6-luna");
    expect(environment.OPENAI_REALTIME_MODEL).toBe(
      "gpt-realtime-2.1-mini",
    );
    expect(environment.OPENAI_REALTIME_VOICE).toBe("marin");
    expect(environment.OPENAI_REALTIME_SPEED).toBe(0.8);
    expect(environment.NOMAD_VAD_THRESHOLD).toBe(0.5);
    expect(environment.NOMAD_VAD_PREFIX_PADDING_MS).toBe(300);
    expect(environment.NOMAD_VAD_SILENCE_MS).toBe(650);
    expect(environment.NOMAD_MAX_CALLS_PER_HOUR).toBe(6);
    expect(environment.NOMAD_SMS_RECAP_ENABLED).toBe(false);
    expect(environment.NOMAD_PUBLIC_PHONE_ENABLED).toBe(false);
    expect(environment.NOMAD_DASHBOARD_TOKEN).toBeUndefined();
  });

  it("accepts an explicit production bind host", () => {
    expect(loadEnvironment({ HOST: "127.0.0.1" }).HOST).toBe("127.0.0.1");
    expect(() => loadEnvironment({ HOST: " " })).toThrow();
  });

  it("requires a sufficiently strong dashboard token when configured", () => {
    expect(() =>
      loadEnvironment({ NOMAD_DASHBOARD_TOKEN: "too-short" }),
    ).toThrow();
    expect(
      loadEnvironment({
        NOMAD_DASHBOARD_TOKEN: "judge-dashboard-token-123456789",
      }).NOMAD_DASHBOARD_TOKEN,
    ).toBe("judge-dashboard-token-123456789");
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

  it("requires an explicit publication switch for the public phone CTA", () => {
    expect(
      loadEnvironment({ NOMAD_PUBLIC_PHONE_ENABLED: "true" })
        .NOMAD_PUBLIC_PHONE_ENABLED,
    ).toBe(true);
    expect(
      loadEnvironment({ NOMAD_PUBLIC_PHONE_ENABLED: "false" })
        .NOMAD_PUBLIC_PHONE_ENABLED,
    ).toBe(false);
  });

  it("prevents accidental live mode without a key", () => {
    const environment = loadEnvironment({ TEACHING_ENGINE: "openai" });
    expect(() => requireOpenAIKey(environment)).toThrow(/offline/);
  });

  it("bounds phone VAD configuration", () => {
    expect(() => loadEnvironment({ NOMAD_VAD_THRESHOLD: "1.1" })).toThrow();
    expect(() => loadEnvironment({ NOMAD_VAD_SILENCE_MS: "100" })).toThrow();
    expect(
      loadEnvironment({
        NOMAD_VAD_THRESHOLD: "0.65",
        NOMAD_VAD_PREFIX_PADDING_MS: "400",
        NOMAD_VAD_SILENCE_MS: "800",
      }),
    ).toMatchObject({
      NOMAD_VAD_THRESHOLD: 0.65,
      NOMAD_VAD_PREFIX_PADDING_MS: 400,
      NOMAD_VAD_SILENCE_MS: 800,
    });
  });

  it("bounds Realtime playback speed", () => {
    expect(loadEnvironment({ OPENAI_REALTIME_SPEED: "0.25" }).OPENAI_REALTIME_SPEED).toBe(0.25);
    expect(loadEnvironment({ OPENAI_REALTIME_SPEED: "1.5" }).OPENAI_REALTIME_SPEED).toBe(1.5);
    expect(() => loadEnvironment({ OPENAI_REALTIME_SPEED: "0.2" })).toThrow();
    expect(() => loadEnvironment({ OPENAI_REALTIME_SPEED: "1.6" })).toThrow();
  });
});
