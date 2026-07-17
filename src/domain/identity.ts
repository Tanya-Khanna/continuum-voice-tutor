import { createHmac } from "node:crypto";

export function normalizeLearnerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function hashPhoneNumber(phoneNumber: string, secret: string): string {
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  if (normalized.length < 6) {
    throw new Error("A valid caller number is required.");
  }
  if (secret.length < 16) {
    throw new Error("The phone-hash secret must contain at least 16 characters.");
  }
  return createHmac("sha256", secret).update(normalized).digest("hex");
}
