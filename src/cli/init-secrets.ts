import {
  initializeLocalDashboardToken,
  initializeLocalApplicationSecrets,
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

const applicationResults = await initializeLocalApplicationSecrets();
const createdCount = Object.values(applicationResults).filter(
  (result) => result !== "already_configured",
).length;
console.log(
  createdCount === 0
    ? "Portable identity, guardian, and callback secrets are already configured; no value was changed or printed."
    : `${createdCount} missing Continuum application secret${createdCount === 1 ? " was" : "s were"} initialized with owner-only file permissions; no value was printed.`,
);
