import { createHmac, timingSafeEqual } from "node:crypto";

export function computeTwilioSignature(options: {
  authToken: string;
  url: string;
  parameters: URLSearchParams;
}): string {
  const names = [...new Set(options.parameters.keys())].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  let payload = options.url;
  for (const name of names) {
    for (const value of options.parameters.getAll(name).sort()) {
      payload += `${name}${value}`;
    }
  }
  return createHmac("sha1", options.authToken)
    .update(payload, "utf8")
    .digest("base64");
}

export function validateTwilioSignature(options: {
  authToken: string;
  url: string;
  parameters: URLSearchParams;
  providedSignature?: string;
}): boolean {
  if (!options.providedSignature) return false;
  const expected = Buffer.from(computeTwilioSignature(options), "utf8");
  const provided = Buffer.from(options.providedSignature, "utf8");
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}
