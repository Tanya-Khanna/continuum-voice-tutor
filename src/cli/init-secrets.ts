import {
  initializeLocalDashboardToken,
  initializeLocalPhoneHashSecret,
} from "../config/init-secrets.js";

const phoneResult = await initializeLocalPhoneHashSecret();
console.log(
  phoneResult === "already_configured"
    ? "Local phone-hash secret is already configured; no value was changed or printed."
    : "Local phone-hash secret initialized with owner-only file permissions; no value was printed.",
);

const dashboardResult = await initializeLocalDashboardToken();
console.log(
  dashboardResult === "already_configured"
    ? "Local dashboard token is already configured; no value was changed or printed."
    : "Local dashboard token initialized with owner-only file permissions; no value was printed.",
);
