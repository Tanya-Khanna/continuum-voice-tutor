import { loadEnvironment } from "../config/env.js";
import { buildPhoneReadinessReport } from "../telephony/readiness.js";

const report = buildPhoneReadinessReport(loadEnvironment());
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Continuum phone readiness: ${report.readyCount}/${report.totalCount}`);
  for (const check of report.checks) {
    console.log(`${check.ready ? "PASS" : "OPEN"} ${check.label}`);
    if (!check.ready) console.log(`  ${check.nextAction}`);
  }
  console.log(`Setup guide: ${report.guidePath}`);
  console.log(
    report.ready
      ? "Release configuration is 11/11; continue with the measured carrier-call behavior gate."
      : report.smokeTestReady
        ? "Configured for one controlled inbound smoke call. After a valid signed delivery, set NOMAD_OPENAI_WEBHOOK_PUBLIC=true and rerun preflight."
        : "Not yet configured for a paid real call; no credential values were printed.",
  );
}
if (!report.ready) process.exitCode = 1;
