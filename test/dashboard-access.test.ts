import { describe, expect, it } from "vitest";
import {
  assertPublicDashboardProtected,
  dashboardRequestAuthorized,
} from "../src/security/dashboard-access.js";

describe("dashboard access boundary", () => {
  const token = "judge-dashboard-token-123456789";

  it("keeps local zero-config access but requires the exact configured bearer token", () => {
    expect(dashboardRequestAuthorized({})).toBe(true);
    expect(dashboardRequestAuthorized({ expectedToken: token })).toBe(false);
    expect(
      dashboardRequestAuthorized({
        expectedToken: token,
        authorizationHeader: "Basic irrelevant",
      }),
    ).toBe(false);
    expect(
      dashboardRequestAuthorized({
        expectedToken: token,
        authorizationHeader: "Bearer wrong-token",
      }),
    ).toBe(false);
    expect(
      dashboardRequestAuthorized({
        expectedToken: token,
        authorizationHeader: `Bearer ${token}`,
      }),
    ).toBe(true);
  });

  it("fails server startup when public webhook mode would expose an unprotected dashboard", () => {
    expect(() =>
      assertPublicDashboardProtected({ publicWebhook: false }),
    ).not.toThrow();
    expect(() =>
      assertPublicDashboardProtected({
        publicWebhook: true,
        dashboardToken: token,
      }),
    ).not.toThrow();
    expect(() =>
      assertPublicDashboardProtected({ publicWebhook: true }),
    ).toThrow(/NOMAD_DASHBOARD_TOKEN/u);
  });
});
