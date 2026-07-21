import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
const freshRoot = mkdtempSync(join(tmpdir(), "continuum-fresh-clone-"));

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
  const listedFiles = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
  );
  if (listedFiles.error) throw listedFiles.error;
  if (listedFiles.status !== 0) {
    throw new Error("Could not list the proposed public repository state.");
  }
  for (const relativePath of listedFiles.stdout.split("\0").filter(Boolean)) {
    const source = join(repositoryRoot, relativePath);
    if (!existsSync(source)) continue;
    const destination = join(freshRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }

  for (const forbiddenPath of [".env", ".data", "node_modules", "dist"]) {
    if (existsSync(join(freshRoot, forbiddenPath))) {
      throw new Error(`Fresh archive unexpectedly contains ${forbiddenPath}.`);
    }
  }

  run("git", ["init", "-q"]);
  run("git", ["add", "-A"]);

  const cleanEnvironment = { ...process.env };
  for (const name of [
    "OPENAI_API_KEY",
    "OPENAI_PROJECT_ID",
    "OPENAI_WEBHOOK_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ]) {
    delete cleanEnvironment[name];
  }
  cleanEnvironment.TEACHING_ENGINE = "offline";
  cleanEnvironment.NOMAD_DATABASE_PATH = join(freshRoot, ".data", "fresh.db");
  cleanEnvironment.NOMAD_PHONE_HASH_SECRET =
    "fresh-clone-verification-only";

  run("npm", ["ci"], { environment: cleanEnvironment });
  run("npm", ["run", "verify"], { environment: cleanEnvironment });
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
    "\nFresh-clone gate passed: lockfile install, formatting hygiene, lint, tests, deterministic eval, production build/smoke, sample-state seed, and exact offline resume all succeeded without local secrets or prior state.",
  );
} finally {
  rmSync(freshRoot, { recursive: true, force: true });
}
