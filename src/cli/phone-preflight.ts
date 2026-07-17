import { loadEnvironment } from "../config/env.js";
import { buildPhoneReadinessReport } from "../telephony/readiness.js";

const report = buildPhoneReadinessReport(loadEnvironment());
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Nomad phone readiness: ${report.readyCount}/${report.totalCount}`);
  for (const check of report.checks) {
    console.log(`${check.ready ? "PASS" : "OPEN"} ${check.label}`);
    if (!check.ready) console.log(`  ${check.nextAction}`);
  }
  console.log(
    report.ready
      ? "Ready for a controlled real-call smoke test."
      : "Not ready for a paid real call; no credential values were printed.",
  );
}
if (!report.ready) process.exitCode = 1;
