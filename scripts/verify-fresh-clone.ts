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

function runCapture(
  command: string,
  args: string[],
  options: { input?: string; environment?: NodeJS.ProcessEnv } = {},
): string {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: freshRoot,
    env: options.environment ?? process.env,
    input: options.input,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}.`);
  }
  return result.stdout;
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

  for (const forbiddenPath of [".env", ".data", "node_modules", "dist"]) {
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
    "NOMAD_CURRICULUM_PATHS",
  ]) {
    delete cleanEnvironment[name];
  }
  cleanEnvironment.TEACHING_ENGINE = "offline";
  cleanEnvironment.NOMAD_DATABASE_PATH = join(freshRoot, ".data", "fresh.db");
  cleanEnvironment.NOMAD_PHONE_HASH_SECRET =
    "fresh-clone-verification-only";

  run("npm", ["ci"], { environment: cleanEnvironment });
  run("npm", ["run", "smoke:production"], { environment: cleanEnvironment });
  run("npm", ["run", "check"], { environment: cleanEnvironment });
  run("npm", ["run", "eval"], { environment: cleanEnvironment });
  const seedOutput = runCapture("npm", ["run", "seed:demo"], {
    environment: cleanEnvironment,
  });
  const pendingPrompt = seedOutput.match(/^Pending prompt: (.+)$/mu)?.[1];
  if (!pendingPrompt) {
    throw new Error("The v7 demo seed did not expose an exact pending prompt.");
  }
  const resumeOutput = runCapture(
    "npm",
    [
      "run",
      "chat",
      "--",
      "--name",
      "Ravi",
      "--phone",
      "+910000000042",
      "--language",
      "en",
    ],
    {
      environment: cleanEnvironment,
      input: "exit\n",
    },
  );
  if (
    !resumeOutput.includes("Session: resumed") ||
    !resumeOutput.includes(pendingPrompt) ||
    !resumeOutput.includes("Session saved after 1 teaching turn")
  ) {
    throw new Error(
      "The fresh v7 session did not resume the exact persisted open-topic question.",
    );
  }

  console.log(
    "\nFresh-clone gate passed: lockfile install, pack-free production smoke, tests, v7 deterministic eval, sample-state seed, and exact offline resume all succeeded without local secrets or prior state.",
  );
} finally {
  rmSync(freshRoot, { recursive: true, force: true });
}
