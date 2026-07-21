import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repositoryRoot = resolve(import.meta.dirname, "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "nomad-production-smoke-"));
const dashboardToken = "production-smoke-dashboard-token";

function buildProductionServer(): void {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Production build exited ${result.status}.`);
  }
}

async function reservePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    probe.once("error", rejectListen);
    probe.listen(0, "127.0.0.1", resolveListen);
  });
  const address = probe.address();
  if (!address || typeof address === "string") {
    probe.close();
    throw new Error("Could not reserve a production smoke-test port.");
  }
  await new Promise<void>((resolveClose, rejectClose) => {
    probe.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  return address.port;
}

function safeEnvironment(port: number): NodeJS.ProcessEnv {
  const environment = { ...process.env };
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
    delete environment[name];
  }
  return {
    ...environment,
    DOTENV_CONFIG_PATH: join(temporaryRoot, "no-local-env"),
    TEACHING_ENGINE: "offline",
    HOST: "127.0.0.1",
    PORT: String(port),
    NOMAD_DATABASE_PATH: join(temporaryRoot, "nomad.db"),
    NOMAD_PHONE_HASH_SECRET: "production-smoke-only-secret",
    NOMAD_DASHBOARD_TOKEN: dashboardToken,
    NOMAD_MISSED_CALL_ENABLED: "false",
    NOMAD_SMS_CONTROLS_ENABLED: "false",
    NOMAD_SMS_REMINDERS_ENABLED: "false",
    NOMAD_SMS_RECAP_ENABLED: "false",
    NOMAD_SCHEDULER_ENABLED: "false",
  };
}

async function waitForHealth(
  process: ChildProcess,
  baseUrl: string,
): Promise<Response> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null || process.signalCode !== null) {
      throw new Error("Compiled production server exited before becoming healthy.");
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return response;
    } catch {
      // The listener may not be bound yet.
    }
    await delay(50);
  }
  throw new Error("Compiled production server did not become healthy in time.");
}

async function expectStatus(
  url: string,
  expectedStatus: number,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== expectedStatus) {
    throw new Error(
      `${url} returned ${response.status}; expected ${expectedStatus}.`,
    );
  }
  return response;
}

async function stopServer(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveClose) => process.once("close", () => resolveClose())),
    delay(2_000).then(() => {
      if (process.exitCode === null && process.signalCode === null) {
        process.kill("SIGKILL");
      }
    }),
  ]);
}

let productionServer: ChildProcess | undefined;
try {
  buildProductionServer();
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  productionServer = spawn(process.execPath, ["dist/start-production.js"], {
    cwd: repositoryRoot,
    env: safeEnvironment(port),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  productionServer.stdout?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString("utf8");
  });
  productionServer.stderr?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString("utf8");
  });

  const health = await waitForHealth(productionServer, baseUrl);
  const healthBody = (await health.json()) as Record<string, unknown>;
  if (
    healthBody.ok !== true ||
    healthBody.teachingEngine !== "offline" ||
    healthBody.realtimeConfigured !== false ||
    healthBody.experience !== "open_topic_teacher" ||
    healthBody.curriculumRequiredForCalls !== false
  ) {
    throw new Error("Production health response did not match the safe smoke config.");
  }

  await expectStatus(`${baseUrl}/dashboard`, 200);
  await expectStatus(`${baseUrl}/api/dashboard/sessions`, 401);
  await expectStatus(`${baseUrl}/api/dashboard/readiness`, 401);
  await expectStatus(`${baseUrl}/api/dashboard/sessions`, 200, {
    headers: { Authorization: `Bearer ${dashboardToken}` },
  });
  const readiness = await expectStatus(
    `${baseUrl}/api/dashboard/readiness`,
    200,
    { headers: { Authorization: `Bearer ${dashboardToken}` } },
  );
  const serializedReadiness = JSON.stringify(await readiness.json());
  for (const sensitiveValue of [
    dashboardToken,
    "production-smoke-only-secret",
  ]) {
    if (serializedReadiness.includes(sensitiveValue)) {
      throw new Error("Production readiness endpoint exposed a configured value.");
    }
  }
  const audio = await expectStatus(
    `${baseUrl}/assets/sample-universal-code-switch.mp3`,
    206,
    { headers: { Range: "bytes=0-31" } },
  );
  if ((await audio.arrayBuffer()).byteLength !== 32) {
    throw new Error("Production audio range response had the wrong size.");
  }
  if (!serverOutput.includes(`127.0.0.1:${port}`)) {
    throw new Error("Production server did not report its configured bind address.");
  }

  console.log(
    "Production smoke passed: compiled pack-free open-topic server, health, dashboard auth, release readiness, SQLite access, and ranged sample audio are deployable without local secrets.",
  );
} finally {
  if (productionServer) await stopServer(productionServer);
  rmSync(temporaryRoot, { recursive: true, force: true });
}
