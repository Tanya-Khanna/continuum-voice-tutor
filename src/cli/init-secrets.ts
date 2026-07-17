import { initializeLocalPhoneHashSecret } from "../config/init-secrets.js";

const result = await initializeLocalPhoneHashSecret();
console.log(
  result === "already_configured"
    ? "Local phone-hash secret is already configured; no value was changed or printed."
    : "Local phone-hash secret initialized with owner-only file permissions; no value was printed.",
);
