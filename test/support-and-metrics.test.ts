import { describe, expect, it } from "vitest";
import { humanSupportDecisionFor } from "../src/domain/classroom.js";
import { ProductMetricEventSchema } from "../src/domain/product-metrics.js";
import {
  LearningEvidenceSchema,
  TeachingFeedbackSchema,
} from "../src/domain/classroom.js";
import { StoredModelUsageSchema } from "../src/domain/usage.js";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";
import { OPEN_TOPIC_NAMESPACE } from "../src/domain/open-topic.js";
import { buildProductMetrics } from "../src/observability/product-metrics.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

const SECRET = "support-metrics-test-secret";

describe("human support and product proof", () => {
  it("separates ordinary struggle from safety and qualified review", () => {
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: false,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 2,
      }),
    ).toBe("none");
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: false,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 3,
      }),
    ).toBe("suggest_teacher");
    expect(
      humanSupportDecisionFor({
        immediateSafetyConcern: true,
        highStakesQuestion: false,
        accommodationRequested: false,
        curriculumReviewNeeded: false,
        distinctFailedStrategies: 0,
      }),
    ).toBe("safety_protocol");
  });

  it("separates access, reliability, and learning metrics with evidence labels", () => {
    const repository = new SqliteLearningRepository(":memory:");
    const now = "2026-07-18T12:00:00.000Z";
    const lessons = new OpenTopicLessonService({
      repository,
      engine: new OfflineOpenTopicEngine(),
      phoneHashSecret: SECRET,
    });
    const learner = lessons.identifyLearner({
      phoneNumber: "+919999900009",
      learnerName: "Metric Learner",
    });
    const context = lessons.beginOrResumeLearner(learner, "missed_call");
    for (const [index, name] of [
      "missed_call_queued",
      "callback_placed",
      "carrier_call_answered",
      "drop_paused",
      "drop_recovered",
    ].entries()) {
      repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: `metric-${index}`,
          name,
          learnerId: null,
          sessionId: null,
          channel: "system",
          accessMode: "missed_call",
          numericValue: null,
          synthetic: true,
          createdAt: now,
        }),
      );
    }
    for (const [id, name, value] of [
      ["duration", "carrier_call_duration_seconds", 120],
      ["cost", "carrier_call_cost_usd", 0.04],
      ["segments", "sms_segments_sent", 2],
      ["terminal", "carrier_call_completed", null],
      ["completed", "lesson_completed", 8],
      ["shared", "shared_phone_lesson_completed", null],
      ["keypad-requested", "keypad_fallback_requested", null],
      ["keypad-completed", "keypad_fallback_completed", null],
      ["audio-requested", "unclear_audio_recovery_requested", null],
      ["audio-recovered", "unclear_audio_recovered", null],
    ] as const) {
      repository.appendProductMetric(
        ProductMetricEventSchema.parse({
          id: `metric-${id}`,
          name,
          learnerId: context.learner.id,
          sessionId: context.session.id,
          channel: "system",
          accessMode: "missed_call",
          numericValue: value,
          synthetic: true,
          createdAt: now,
        }),
      );
    }
    for (const [
      id,
      kind,
      result,
      independent,
      strategy,
      hintCount,
      createdAt,
    ] of [
      [
        "diagnostic-evidence",
        "diagnostic",
        "incorrect",
        false,
        "ask_reasoning",
        2,
        "2026-07-18T12:00:00.000Z",
      ],
      [
        "teach-back-evidence",
        "teach_back",
        "correct",
        false,
        "teach_back",
        1,
        "2026-07-18T12:01:00.000Z",
      ],
      [
        "transfer-evidence",
        "transfer",
        "correct",
        true,
        "transfer",
        0,
        "2026-07-18T12:02:00.000Z",
      ],
      [
        "retention-evidence",
        "retention",
        "correct",
        true,
        "retrieval_practice",
        0,
        "2026-07-18T12:03:00.000Z",
      ],
    ] as const) {
      repository.appendLearningEvidence(
        LearningEvidenceSchema.parse({
          id,
          learnerId: context.learner.id,
          sessionId: context.session.id,
          curriculumPackId: OPEN_TOPIC_NAMESPACE,
          concept: context.session.concept,
          activityId: `${id}-activity`,
          kind,
          result,
          independent,
          responseMode: "speech",
          reasoningEvidence: "Synthetic metric fixture evidence.",
          strategy,
          hintCount,
          createdAt,
        }),
      );
    }
    repository.appendTeachingFeedback(
      TeachingFeedbackSchema.parse({
        id: "helpful-feedback",
        learnerId: context.learner.id,
        sessionId: context.session.id,
        subject: "Open learning",
        strategy: "concrete_analogy",
        helpfulness: "helpful",
        pace: "right",
        preferredActivity: "analogy",
        objectiveResult: "correct",
        responseMode: "speech",
        createdAt: now,
      }),
    );
    for (const [id, latencyMs] of [["usage-fast", 100], ["usage-slow", 900]] as const) {
      repository.appendUsage(
        StoredModelUsageSchema.parse({
          id,
          sessionId: context.session.id,
          source: "responses_teaching",
          modelRoute: "unpriced-test-model",
          inputTextTokens: 0,
          cachedInputTextTokens: 0,
          outputTextTokens: 0,
          inputAudioTokens: 0,
          cachedInputAudioTokens: 0,
          outputAudioTokens: 0,
          latencyMs,
          createdAt: now,
        }),
      );
    }
    expect(buildProductMetrics(repository)).toMatchObject({
      evidenceScope: "synthetic",
      access: {
        missedCallCallbackConversion: 1,
        completedCallMinutes: 2,
        smsSegmentsSent: 2,
        carrierCostUsd: 0.04,
        keypadFallbackCompletionRate: 1,
        sharedPhoneCompletions: 1,
        sponsorFundedLessonCompletions: 1,
        costPerCompletedLessonUsd: 0.04,
        costPerRetainedConceptUsd: 0.04,
      },
      reliability: {
        droppedCallRecoveryRate: 1,
        exactResumeAccuracy: 1,
        unclearAudioRecoveryRate: 1,
        carrierCallCompletionRate: 1,
        applicationResponseLatencyMedianMs: 100,
        applicationResponseLatencyP95Ms: 900,
      },
      learning: {
        diagnosticSuccessRate: 0,
        transferSuccessRate: 1,
        diagnosticToTransferImprovement: 1,
        retentionSuccessRate: 1,
        averageHintReduction: 2,
        teachBackSuccessRate: 1,
        learnerReportedHelpfulnessRate: 1,
      },
    });
    repository.close();
  });
});
