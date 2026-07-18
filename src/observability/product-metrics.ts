import type { LearningRepository } from "../domain/learner.js";

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function buildProductMetrics(repository: LearningRepository): {
  evidenceScope: "empty" | "synthetic" | "live" | "mixed";
  access: Record<string, number | null>;
  reliability: Record<string, number | null>;
  learning: Record<string, number | null>;
} {
  const events = repository.listProductMetrics();
  const eventCount = (name: string) =>
    events.filter((event) => event.name === name).length;
  const sessions = repository.listRecentLessons(100);
  const learnerIds = [...new Set(sessions.map((session) => session.learnerId))];
  const evidence = learnerIds.flatMap((learnerId) =>
    repository.listLearningEvidence(learnerId, 500),
  );
  const decisions = sessions.flatMap((session) =>
    repository.listPedagogyDecisions(session.id),
  );
  const diagnostics = evidence.filter((item) => item.kind === "diagnostic");
  const transfer = evidence.filter((item) => item.kind === "transfer");
  const retention = evidence.filter((item) => item.kind === "retention");
  const strategySwitches = decisions.filter((decision) => decision.strategyChanged);
  const successfulSwitches = strategySwitches.filter(
    (decision) =>
      decision.evidenceResult === "correct" ||
      decision.evidenceResult === "partial",
  );
  const scopes = new Set(events.map((event) => event.synthetic));
  const evidenceScope =
    events.length === 0
      ? "empty"
      : scopes.size > 1
        ? "mixed"
        : scopes.has(true)
          ? "synthetic"
          : "live";
  return {
    evidenceScope,
    access: {
      lessonsCompletedWithoutMobileData: eventCount("lesson_completed"),
      missedCallCallbackConversion: ratio(
        eventCount("callback_placed"),
        eventCount("missed_call_queued"),
      ),
      keypadFallbackCompletions: eventCount("keypad_fallback_completed"),
      crossPhoneResumptions: eventCount("cross_phone_resumed"),
    },
    reliability: {
      droppedCallRecoveryRate: ratio(
        eventCount("drop_recovered"),
        eventCount("drop_paused"),
      ),
      scheduledDialSuccessRate: ratio(
        eventCount("scheduled_call_dialed"),
        eventCount("scheduled_call_dialed") +
          eventCount("scheduled_call_failed"),
      ),
      smsCommandsProcessed: eventCount("sms_command_processed"),
    },
    learning: {
      diagnosticChecks: diagnostics.length,
      transferSuccessRate: ratio(
        transfer.filter((item) => item.result === "correct").length,
        transfer.length,
      ),
      retentionSuccessRate: ratio(
        retention.filter((item) => item.result === "correct").length,
        retention.length,
      ),
      averageHints:
        evidence.length === 0
          ? null
          : evidence.reduce((sum, item) => sum + item.hintCount, 0) /
            evidence.length,
      strategySwitchSuccessRate: ratio(
        successfulSwitches.length,
        strategySwitches.length,
      ),
      homeworkCompletions: eventCount("homework_completed"),
    },
  };
}
