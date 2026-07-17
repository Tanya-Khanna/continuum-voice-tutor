import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

const defaultPhoneHashSecret = "local-development-change-me";

export async function initializeLocalPhoneHashSecret(
  path = ".env",
): Promise<"created" | "rotated_default" | "already_configured"> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      contents = "";
    } else {
      throw error;
    }
  }

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
  await writeFile(path, nextContents, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
  return match ? "rotated_default" : "created";
}
