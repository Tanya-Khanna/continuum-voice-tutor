import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initializeLocalPhoneHashSecret } from "../src/config/init-secrets.js";

describe("local secret initializer", () => {
  it("rotates only the development default and never rewrites a configured secret", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nomad-secrets-"));
    const path = join(directory, ".env");
    await writeFile(
      path,
      "OPENAI_API_KEY=keep-this\nNOMAD_PHONE_HASH_SECRET=local-development-change-me\n",
      "utf8",
    );
    expect(await initializeLocalPhoneHashSecret(path)).toBe("rotated_default");
    const first = await readFile(path, "utf8");
    expect(first).toContain("OPENAI_API_KEY=keep-this");
    expect(first).toMatch(/NOMAD_PHONE_HASH_SECRET=nomad_[A-Za-z0-9_-]{43}/u);
    expect(first).not.toContain("local-development-change-me");
    expect((await stat(path)).mode & 0o777).toBe(0o600);

    expect(await initializeLocalPhoneHashSecret(path)).toBe(
      "already_configured",
    );
    expect(await readFile(path, "utf8")).toBe(first);
  });
});
