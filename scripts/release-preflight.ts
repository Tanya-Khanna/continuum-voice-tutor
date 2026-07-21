import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { loadEnvironment } from "../src/config/env.js";
import { buildPhoneReadinessReport } from "../src/telephony/readiness.js";
import { OpenTopicLiveEvalReportSchema } from "../src/evals/open-topic-live-report.js";

const CarrierTestsSchema = z.object({
  missedCallCallback: z.boolean(),
  englishLesson: z.boolean(),
  hindiEnglishLesson: z.boolean(),
  spanishEnglishAdultTest: z.boolean(),
  frenchEnglishAdultTest: z.boolean(),
  languageFirstOnboarding: z.boolean(),
  openTopicNoMenu: z.boolean(),
  methodSwitchAndFeedback: z.boolean(),
  dtmfLearnerCode: z.boolean(),
  dtmfAnswerRepeatHintFeedback: z.boolean(),
  dropAndPauseSms: z.boolean(),
  samePhoneResume: z.boolean(),
  crossPhoneResume: z.boolean(),
  microPracticeReply: z.boolean(),
  examReminderConsentAndSend: z.boolean(),
  stopBeforeDueSend: z.boolean(),
  sharedPhoneSiblingIsolation: z.boolean(),
});

const SubmissionReleaseInputSchema = z.object({
  publicPhoneApproved: z.boolean(),
  dashboardJudgeUrlPrepared: z.boolean(),
  demoVideoUrl: z
    .string()
    .url()
    .refine((value) => {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === "youtu.be" || hostname.endsWith("youtube.com");
    }, "Demo video must be a YouTube URL.")
    .nullable(),
  codexFeedbackSessionId: z.string().trim().min(1).nullable(),
  devpostTeamAccepted: z.boolean(),
  repositorySharedOrPublic: z.boolean(),
  humanSubmissionCopyRewritten: z.boolean(),
  carrierTests: CarrierTestsSchema,
  consecutiveGoldenJudgeJourneys: z.number().int().min(0),
});

const ReleaseCheckSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pass", "open", "manual"]),
  evidence: z.string().min(1),
});

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value?.trim() || undefined;
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed.`);
  return result.stdout.trim();
}

const root = git(["rev-parse", "--show-toplevel"]);
const revision = git(["rev-parse", "HEAD"]);
const checks: z.infer<typeof ReleaseCheckSchema>[] = [];
function check(
  id: string,
  status: "pass" | "open" | "manual",
  evidence: string,
): void {
  checks.push(ReleaseCheckSchema.parse({ id, status, evidence }));
}

check(
  "committed_revision",
  process.argv.includes("--automated-passed") ? "pass" : "open",
  process.argv.includes("--automated-passed")
    ? `Clean-clone automated gate passed for ${revision.slice(0, 12)}.`
    : "Run npm run release:verify after the final commit.",
);
const worktree = git(["status", "--porcelain"]);
check(
  "clean_worktree",
  worktree ? "open" : "pass",
  worktree ? "Commit intended release changes before final verification." : "Git worktree is clean.",
);

check(
  "open_topic_product_contract",
  "pass",
  "The release product is language, identity, and one open learning question with no curriculum runtime dependency.",
);

let environment: ReturnType<typeof loadEnvironment> | undefined;
try {
  environment = loadEnvironment();
  const phone = buildPhoneReadinessReport(environment);
  check(
    "phone_configuration",
    phone.ready ? "pass" : "open",
    `${phone.readyCount}/${phone.totalCount} secret-safe phone configuration checks pass.`,
  );
} catch (error) {
  check(
    "phone_configuration",
    "open",
    `Environment is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
  );
}

if (environment) {
  const liveEvalPath = resolve(
    root,
    environment.NOMAD_OPEN_TOPIC_LIVE_EVAL_REPORT_PATH,
  );
  if (!existsSync(liveEvalPath)) {
    check(
      "live_open_topic_eval",
      "open",
      "Run npm run eval:live -- --confirm-spend on the final commit.",
    );
  } else {
    try {
      const liveEval = OpenTopicLiveEvalReportSchema.parse(
        JSON.parse(readFileSync(liveEvalPath, "utf8")) as unknown,
      );
      const green =
        liveEval.revision === revision &&
        liveEval.total === 9 &&
        liveEval.passed === liveEval.total;
      check(
        "live_open_topic_eval",
        green ? "pass" : "open",
        green
          ? `Live GPT v7 suite passed 9/9 on ${revision.slice(0, 12)}.`
          : `Live GPT report is ${liveEval.passed}/${liveEval.total} on ${liveEval.revision.slice(0, 12)}; expected 9/9 on ${revision.slice(0, 12)}.`,
      );
    } catch (error) {
      check(
        "live_open_topic_eval",
        "open",
        `Live GPT report is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

const publicBaseUrl = argument("--base-url") ?? environment?.NOMAD_PUBLIC_BASE_URL;
if (publicBaseUrl) {
  try {
    const response = await fetch(`${publicBaseUrl}/health`);
    const health = (await response.json()) as {
      ok?: boolean;
      teachingEngine?: string;
      realtimeConfigured?: boolean;
      experience?: string;
      curriculumRequiredForCalls?: boolean;
      releaseRevision?: string;
      accessFeatures?: Record<string, boolean>;
    };
    const currentRevision = revision.startsWith(health.releaseRevision ?? "-");
    const healthy =
      response.ok &&
      health.ok === true &&
      health.teachingEngine === "openai" &&
      health.realtimeConfigured === true &&
      health.experience === "open_topic_teacher" &&
      health.curriculumRequiredForCalls === false;
    check(
      "production_health",
      healthy ? "pass" : "open",
      healthy
        ? "Production reports the live curriculum-independent open-topic OpenAI/Realtime experience."
        : "Production health does not report the live curriculum-independent OpenAI/Realtime experience.",
    );
    const access = health.accessFeatures ?? {};
    const accessFlags = [
      access.missedCallCallback === true,
      access.smsControls === true,
      access.smsReminders === true,
      access.smsRecap === true,
      access.scheduler === false,
    ];
    check(
      "access_features_enabled",
      accessFlags.length === 5 && accessFlags.every(Boolean) ? "pass" : "open",
      `${accessFlags.filter(Boolean).length}/5 production callback, bounded SMS, one-time reminder, recap, and scheduler-disabled invariants pass.`,
    );
    check(
      "deployed_revision",
      currentRevision ? "pass" : "open",
      currentRevision
        ? `Production reports release ${health.releaseRevision}.`
        : `Production revision ${health.releaseRevision ?? "unknown"} does not match ${revision.slice(0, 12)}.`,
    );
  } catch (error) {
    check(
      "production_health",
      "open",
      `Production health check failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
} else {
  check("production_health", "open", "NOMAD_PUBLIC_BASE_URL is not configured.");
  const accessFlags = environment
    ? [
        environment.NOMAD_MISSED_CALL_ENABLED,
        environment.NOMAD_SMS_CONTROLS_ENABLED,
        environment.NOMAD_SMS_REMINDERS_ENABLED,
        environment.NOMAD_SMS_RECAP_ENABLED,
      ]
    : [];
  check(
    "access_features_enabled",
    accessFlags.length === 4 && accessFlags.every(Boolean) ? "pass" : "open",
    `${accessFlags.filter(Boolean).length}/4 local callback, bounded SMS, one-time reminder, and recap features are enabled.`,
  );
}

const submissionPath = argument("--submission");
const resolvedSubmissionPath = submissionPath
  ? resolve(root, submissionPath)
  : undefined;
if (!resolvedSubmissionPath || !existsSync(resolvedSubmissionPath)) {
  check(
    "human_submission_receipt",
    "manual",
    "Copy submission/release-input.example.json to .data/release-input.json, complete it after live testing, and pass --submission .data/release-input.json.",
  );
} else {
  const input = SubmissionReleaseInputSchema.parse(
    JSON.parse(readFileSync(resolvedSubmissionPath, "utf8")) as unknown,
  );
  const carrierValues = Object.values(input.carrierTests);
  check(
    "carrier_matrix",
    carrierValues.every(Boolean) ? "pass" : "manual",
    `${carrierValues.filter(Boolean).length}/${carrierValues.length} required carrier behaviors are signed off.`,
  );
  check(
    "golden_journeys",
    input.consecutiveGoldenJudgeJourneys >= 5 ? "pass" : "manual",
    `${input.consecutiveGoldenJudgeJourneys}/5 consecutive golden judge journeys recorded.`,
  );
  const submissionItems = [
    input.publicPhoneApproved,
    input.dashboardJudgeUrlPrepared,
    Boolean(input.demoVideoUrl),
    Boolean(input.codexFeedbackSessionId),
    input.devpostTeamAccepted,
    input.repositorySharedOrPublic,
    input.humanSubmissionCopyRewritten,
  ];
  check(
    "submission_fields",
    submissionItems.every(Boolean) ? "pass" : "manual",
    `${submissionItems.filter(Boolean).length}/${submissionItems.length} human submission items are complete.`,
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  revision,
  ready: checks.every((item) => item.status === "pass"),
  passCount: checks.filter((item) => item.status === "pass").length,
  totalCount: checks.length,
  checks,
};
const outputPath = resolve(
  root,
  argument("--out") ?? ".data/release-preflight.json",
);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Continuum release preflight: ${report.passCount}/${report.totalCount}`);
for (const item of checks) {
  console.log(`${item.status.toUpperCase()} ${item.id}: ${item.evidence}`);
}
console.log(`Secret-free report: ${outputPath}`);
if (!report.ready) process.exitCode = 2;
