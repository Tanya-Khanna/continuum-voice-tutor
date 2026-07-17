import { timingSafeEqual } from "node:crypto";

export function dashboardRequestAuthorized(options: {
  expectedToken?: string;
  authorizationHeader?: string | readonly string[];
}): boolean {
  if (!options.expectedToken) return true;
  if (typeof options.authorizationHeader !== "string") return false;
  const match = /^Bearer\s+(.+)$/iu.exec(options.authorizationHeader);
  const providedToken = match?.[1];
  if (!providedToken) return false;

  const expected = Buffer.from(options.expectedToken, "utf8");
  const provided = Buffer.from(providedToken, "utf8");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export function assertPublicDashboardProtected(options: {
  publicWebhook: boolean;
  dashboardToken?: string;
}): void {
  if (options.publicWebhook && !options.dashboardToken) {
    throw new Error(
      "NOMAD_DASHBOARD_TOKEN is required before enabling the public webhook on this server.",
    );
  }
}
