import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { buildPhoneReadinessReport } from "../src/telephony/readiness.js";

describe("phone readiness preflight", () => {
  it("reports external console work without exposing credential values", () => {
    const report = buildPhoneReadinessReport(
      loadEnvironment({
        TEACHING_ENGINE: "openai",
        OPENAI_API_KEY: "secret-openai-value",
        OPENAI_PROJECT_ID: "proj_private_value",
        OPENAI_WEBHOOK_SECRET: "secret-webhook-value",
        TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
        TWILIO_AUTH_TOKEN: "secret-twilio-value",
        TWILIO_PHONE_NUMBER: "+14155550100",
      }),
    );
    const serialized = JSON.stringify(report);
    expect(report.ready).toBe(false);
    expect(
      report.checks.find((check) => check.id === "openai_api_key")?.ready,
    ).toBe(true);
    expect(
      report.checks.find((check) => check.id === "twilio_sip_trunk")?.ready,
    ).toBe(false);
    expect(serialized).not.toContain("secret-openai-value");
    expect(serialized).not.toContain("secret-twilio-value");
    expect(serialized).not.toContain("+14155550100");
  });

  it("becomes ready only after every local and operator check passes", () => {
    const report = buildPhoneReadinessReport(
      loadEnvironment({
        TEACHING_ENGINE: "openai",
        OPENAI_API_KEY: "configured",
        OPENAI_PROJECT_ID: "proj_configured",
        OPENAI_WEBHOOK_SECRET: "configured",
        NOMAD_OPENAI_WEBHOOK_PUBLIC: "true",
        NOMAD_PHONE_HASH_SECRET: "a-real-deployment-secret",
        NOMAD_DASHBOARD_TOKEN: "judge-dashboard-token-123456789",
        TWILIO_ACCOUNT_SID: `AC${"b".repeat(32)}`,
        TWILIO_AUTH_TOKEN: "configured",
        TWILIO_PHONE_NUMBER: "+14155550100",
        NOMAD_TWILIO_NUMBER_VOICE_READY: "true",
        NOMAD_TWILIO_SIP_TRUNK_CONFIGURED: "true",
      }),
    );
    expect(report).toMatchObject({
      ready: true,
      smokeTestReady: true,
      readyCount: 11,
      totalCount: 11,
      guidePath: "docs/PHONE_SETUP.md",
    });
  });

  it("allows exactly one controlled smoke call before signed delivery is attested", () => {
    const report = buildPhoneReadinessReport(
      loadEnvironment({
        TEACHING_ENGINE: "openai",
        OPENAI_API_KEY: "configured",
        OPENAI_PROJECT_ID: "proj_configured",
        OPENAI_WEBHOOK_SECRET: "configured",
        NOMAD_PHONE_HASH_SECRET: "a-real-deployment-secret",
        NOMAD_DASHBOARD_TOKEN: "judge-dashboard-token-123456789",
        TWILIO_ACCOUNT_SID: `AC${"c".repeat(32)}`,
        TWILIO_AUTH_TOKEN: "configured",
        TWILIO_PHONE_NUMBER: "+14155550100",
        NOMAD_TWILIO_NUMBER_VOICE_READY: "true",
        NOMAD_TWILIO_SIP_TRUNK_CONFIGURED: "true",
      }),
    );

    expect(report).toMatchObject({
      ready: false,
      smokeTestReady: true,
      readyCount: 10,
      totalCount: 11,
    });
    expect(
      report.checks.filter((check) => !check.ready).map((check) => check.id),
    ).toEqual(["public_signed_webhook"]);
  });

  it("does not count placeholder-shaped account values as configuration", () => {
    const report = buildPhoneReadinessReport(
      loadEnvironment({
        OPENAI_PROJECT_ID: "default-project",
        TWILIO_ACCOUNT_SID: "account-sid",
        TWILIO_AUTH_TOKEN: "configured",
        TWILIO_PHONE_NUMBER: "4155550100",
      }),
    );

    for (const id of [
      "openai_project_id",
      "twilio_credentials",
      "twilio_phone_number",
    ]) {
      expect(report.checks.find((check) => check.id === id)?.ready).toBe(false);
    }
  });
});
