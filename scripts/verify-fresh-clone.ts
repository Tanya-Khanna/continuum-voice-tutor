import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRootResult = spawnSync(
  "git",
  ["rev-parse", "--show-toplevel"],
  { encoding: "utf8" },
);
if (repositoryRootResult.status !== 0) {
  throw new Error("verify:fresh must run inside a Git repository.");
}
const repositoryRoot = repositoryRootResult.stdout.trim();
const freshRoot = mkdtempSync(join(tmpdir(), "nomad-fresh-clone-"));

function run(
  command: string,
  args: string[],
  options: { input?: string; environment?: NodeJS.ProcessEnv } = {},
): void {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: freshRoot,
    env: options.environment ?? process.env,
    input: options.input,
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}.`);
  }
}

try {
  const archive = spawnSync(
    "git",
    ["-C", repositoryRoot, "archive", "--format=tar", "HEAD"],
    { maxBuffer: 100 * 1024 * 1024 },
  );
  if (archive.error) throw archive.error;
  if (archive.status !== 0 || !archive.stdout) {
    throw new Error("Could not archive the committed repository state.");
  }
  const extract = spawnSync("tar", ["-xf", "-", "-C", freshRoot], {
    input: archive.stdout,
    maxBuffer: 100 * 1024 * 1024,
  });
  if (extract.error) throw extract.error;
  if (extract.status !== 0) throw new Error("Could not extract Git archive.");

  for (const forbiddenPath of [".env", ".data", "node_modules"]) {
    if (existsSync(join(freshRoot, forbiddenPath))) {
      throw new Error(`Fresh archive unexpectedly contains ${forbiddenPath}.`);
    }
  }

  const cleanEnvironment = { ...process.env };
  for (const name of [
    "OPENAI_API_KEY",
    "OPENAI_PROJECT_ID",
    "OPENAI_WEBHOOK_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "NOMAD_CURRICULUM_PATH",
  ]) {
    delete cleanEnvironment[name];
  }
  cleanEnvironment.TEACHING_ENGINE = "offline";
  cleanEnvironment.NOMAD_DATABASE_PATH = join(freshRoot, ".data", "fresh.db");
  cleanEnvironment.NOMAD_PHONE_HASH_SECRET =
    "fresh-clone-verification-only";

  run("npm", ["ci"], { environment: cleanEnvironment });
  run("npm", ["run", "check"], { environment: cleanEnvironment });
  run("npm", ["run", "eval"], { environment: cleanEnvironment });
  run(
    "npm",
    [
      "run",
      "chat",
      "--",
      "--name",
      "Fresh Clone Learner",
      "--phone",
      "+910000000099",
      "--language",
      "en",
    ],
    {
      environment: cleanEnvironment,
      input: "One fourth is bigger because four is bigger than three.\nexit\n",
    },
  );

  console.log(
    "\nFresh-clone gate passed: lockfile install, tests, deterministic eval, and offline lesson all succeeded without local secrets or state.",
  );
} finally {
  rmSync(freshRoot, { recursive: true, force: true });
}
