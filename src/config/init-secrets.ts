import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

const defaultPhoneHashSecret = "local-development-change-me";

type SecretInitializationResult =
  | "created"
  | "rotated_default"
  | "already_configured";

async function readEnvironmentFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return "";
    }
    throw error;
  }
}

async function writePrivateEnvironmentFile(
  path: string,
  contents: string,
): Promise<void> {
  await writeFile(path, contents, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

export async function initializeLocalPhoneHashSecret(
  path = ".env",
): Promise<SecretInitializationResult> {
  const contents = await readEnvironmentFile(path);

  const match = /^NOMAD_PHONE_HASH_SECRET=(.*)$/mu.exec(contents);
  if (match?.[1] && match[1] !== defaultPhoneHashSecret) {
    await chmod(path, 0o600);
    return "already_configured";
  }

  const secret = `nomad_${randomBytes(32).toString("base64url")}`;
  const nextContents = match
    ? contents.replace(
        /^NOMAD_PHONE_HASH_SECRET=.*$/mu,
        `NOMAD_PHONE_HASH_SECRET=${secret}`,
      )
    : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}NOMAD_PHONE_HASH_SECRET=${secret}\n`;
  await writePrivateEnvironmentFile(path, nextContents);
  return match ? "rotated_default" : "created";
}

export async function initializeLocalDashboardToken(
  path = ".env",
): Promise<"created" | "already_configured"> {
  const contents = await readEnvironmentFile(path);
  const match = /^NOMAD_DASHBOARD_TOKEN=(.*)$/mu.exec(contents);
  if (match?.[1]) {
    if (match[1].length < 24) {
      throw new Error(
        "NOMAD_DASHBOARD_TOKEN is configured but shorter than 24 characters; remove it before generating a replacement.",
      );
    }
    await chmod(path, 0o600);
    return "already_configured";
  }

  const token = `dash_${randomBytes(32).toString("base64url")}`;
  const nextContents = match
    ? contents.replace(
        /^NOMAD_DASHBOARD_TOKEN=.*$/mu,
        `NOMAD_DASHBOARD_TOKEN=${token}`,
      )
    : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}NOMAD_DASHBOARD_TOKEN=${token}\n`;
  await writePrivateEnvironmentFile(path, nextContents);
  return "created";
}
