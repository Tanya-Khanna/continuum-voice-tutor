import type { LearningRepository } from "../domain/learner.js";
import { estimateUsageCost } from "./pricing.js";

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index] ?? null;
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildProductMetrics(repository: LearningRepository): {
  evidenceScope: "empty" | "synthetic" | "live" | "mixed";
  access: Record<string, number | null>;
  reliability: Record<string, number | null>;
  learning: Record<string, number | null>;
} {
  const events = repository.listProductMetrics();
  const eventCount = (name: string, accessMode?: string) =>
    events.filter(
      (event) =>
        event.name === name &&
        (accessMode === undefined || event.accessMode === accessMode),
    ).length;
  const eventTotal = (name: string) =>
    events
      .filter((event) => event.name === name)
      .reduce((sum, event) => sum + (event.numericValue ?? 0), 0);
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
  const teachBack = evidence.filter((item) => item.kind === "teach_back");
  const feedback = learnerIds.flatMap((learnerId) =>
    repository.listTeachingFeedback(learnerId, 500),
  );
  const strategySwitches = decisions.filter((decision) => decision.strategyChanged);
  const successfulSwitches = strategySwitches.filter(
    (decision) =>
      decision.evidenceResult === "correct" ||
      decision.evidenceResult === "partial",
  );
  const scopes = new Set(events.map((event) => event.synthetic));
  const carrierTerminalCount =
    eventCount("carrier_call_completed") +
    eventCount("carrier_call_no_answer") +
    eventCount("carrier_call_failed");
  const carrierCostUsd = eventTotal("carrier_call_cost_usd");
  const usage = repository.listAllUsage();
  const openAiCostUsd = usage
    .map(estimateUsageCost)
    .reduce((sum, estimate) => sum + (estimate.usd ?? 0), 0);
  const responseLatencies = usage.flatMap((item) =>
    item.latencyMs === undefined ? [] : [item.latencyMs],
  );
  const completedLessons = eventCount("lesson_completed");
  const retainedConcepts = new Set(
    retention
      .filter((item) => item.result === "correct" && item.independent)
      .map(
        (item) =>
          `${item.learnerId}:${item.curriculumPackId}:${item.concept}`,
      ),
  ).size;
  const totalObservedCostUsd = carrierCostUsd + openAiCostUsd;
  const diagnosticSuccessRate = ratio(
    diagnostics.filter((item) => item.result === "correct").length,
    diagnostics.length,
  );
  const transferSuccessRate = ratio(
    transfer.filter((item) => item.result === "correct").length,
    transfer.length,
  );
  const evidenceByLearnerConcept = new Map<
    string,
    typeof evidence
  >();
  for (const item of evidence) {
    if (item.kind === "reflection" || item.kind === "homework") continue;
    const key = `${item.learnerId}:${item.curriculumPackId}:${item.concept}`;
    const items = evidenceByLearnerConcept.get(key) ?? [];
    items.push(item);
    evidenceByLearnerConcept.set(key, items);
  }
  const hintReductions = [...evidenceByLearnerConcept.values()].flatMap(
    (items) => {
      if (items.length < 2) return [];
      const chronological = [...items].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      return [
        chronological[0]!.hintCount - chronological.at(-1)!.hintCount,
      ];
    },
  );
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
        eventCount("carrier_call_answered", "missed_call"),
        eventCount("missed_call_queued"),
      ),
      keypadFallbackCompletions: eventCount("keypad_fallback_completed"),
      keypadFallbackCompletionRate: ratio(
        eventCount("keypad_fallback_completed"),
        eventCount("keypad_fallback_requested"),
      ),
      sharedPhoneCompletions: eventCount("shared_phone_lesson_completed"),
      crossPhoneResumptions: eventCount("cross_phone_resumed"),
      sponsorFundedLessonCompletions:
        eventCount("lesson_completed", "missed_call") +
        eventCount("lesson_completed", "sponsored") +
        eventCount("lesson_completed", "scheduled"),
      learnerPaidLessonCompletions: eventCount(
        "lesson_completed",
        "direct_dial",
      ),
      unknownAccessModeLessonCompletions: eventCount(
        "lesson_completed",
        "unknown",
      ),
      completedCallMinutes: eventTotal("carrier_call_duration_seconds") / 60,
      smsSegmentsSent: eventTotal("sms_segments_sent"),
      carrierCostUsd,
      estimatedOpenAiCostUsd: openAiCostUsd,
      costPerCompletedLessonUsd: ratio(
        totalObservedCostUsd,
        completedLessons,
      ),
      costPerRetainedConceptUsd: ratio(
        totalObservedCostUsd,
        retainedConcepts,
      ),
    },
    reliability: {
      carrierCallCompletionRate: ratio(
        eventCount("carrier_call_completed"),
        carrierTerminalCount,
      ),
      carrierAnswerRate: ratio(
        eventCount("carrier_call_answered"),
        eventCount("callback_placed") + eventCount("scheduled_call_dialed"),
      ),
      droppedCallRecoveryRate: ratio(
        eventCount("drop_recovered"),
        eventCount("drop_paused"),
      ),
      exactResumeAccuracy: ratio(
        eventCount("drop_recovered"),
        eventCount("drop_paused"),
      ),
      unclearAudioRecoveryRate: ratio(
        eventCount("unclear_audio_recovered"),
        eventCount("unclear_audio_recovery_requested"),
      ),
      scheduledDialSuccessRate: ratio(
        eventCount("scheduled_call_dialed"),
        eventCount("scheduled_call_dialed") +
          eventCount("scheduled_call_failed"),
      ),
      scheduledCallAnswerRate: ratio(
        eventCount("carrier_call_answered", "scheduled"),
        eventCount("scheduled_call_dialed"),
      ),
      smsCommandsProcessed: eventCount("sms_command_processed"),
      smsDeliveryRate: ratio(
        eventCount("sms_delivered"),
        eventCount("sms_delivered") + eventCount("sms_failed"),
      ),
      applicationResponseLatencyMedianMs: percentile(responseLatencies, 0.5),
      applicationResponseLatencyP95Ms: percentile(responseLatencies, 0.95),
    },
    learning: {
      diagnosticChecks: diagnostics.length,
      diagnosticSuccessRate,
      transferSuccessRate,
      diagnosticToTransferImprovement:
        diagnosticSuccessRate === null || transferSuccessRate === null
          ? null
          : transferSuccessRate - diagnosticSuccessRate,
      retentionSuccessRate: ratio(
        retention.filter((item) => item.result === "correct").length,
        retention.length,
      ),
      averageHints:
        evidence.length === 0
          ? null
          : evidence.reduce((sum, item) => sum + item.hintCount, 0) /
            evidence.length,
      averageHintReduction: average(hintReductions),
      teachBackSuccessRate: ratio(
        teachBack.filter((item) => item.result === "correct").length,
        teachBack.length,
      ),
      learnerReportedHelpfulnessRate: ratio(
        feedback.filter((item) => item.helpfulness === "helpful").length,
        feedback.length,
      ),
      strategySwitchSuccessRate: ratio(
        successfulSwitches.length,
        strategySwitches.length,
      ),
      homeworkCompletions: eventCount("homework_completed"),
    },
  };
}
