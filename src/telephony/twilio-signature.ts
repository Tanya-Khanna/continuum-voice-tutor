import { createHmac } from "node:crypto";
import { validateRequest } from "twilio";

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
  const parameters: Record<string, string | string[]> = {};
  for (const name of new Set(options.parameters.keys())) {
    const values = options.parameters.getAll(name);
    parameters[name] = values.length === 1 ? values[0]! : values;
  }
  // Twilio's own validator deliberately checks signatures generated with and
  // without the standard HTTPS/HTTP port. Twilio documents that its signing
  // backend is inconsistent about including those ports, so a single manual
  // HMAC comparison can reject a genuine provider webhook behind a proxy.
  return validateRequest(
    options.authToken,
    options.providedSignature,
    options.url,
    parameters,
  );
}
