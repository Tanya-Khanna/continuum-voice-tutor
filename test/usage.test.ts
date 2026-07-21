import { describe, expect, it } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { usageFromOpenTopicResponse } from "../src/engine/openai-open-topic-engine.js";
import { estimateUsageCost } from "../src/observability/pricing.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { LearnerProfileSchema, LessonSessionSchema } from "../src/domain/learner.js";
import { StoredModelUsageSchema } from "../src/domain/usage.js";

describe("model usage provenance", () => {
  it("normalizes Responses usage and prices cached text independently", () => {
    const usage = usageFromOpenTopicResponse({
      usage: {
        input_tokens: 1_000,
        input_tokens_details: { cached_tokens: 400, cache_write_tokens: 0 },
        output_tokens: 200,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 1_200,
      } satisfies ResponseUsage,
      modelRoute: "gpt-5.6-luna",
      providerResponseId: "resp_123",
      latencyMs: 321.5,
    });

    const estimate = estimateUsageCost(
      StoredModelUsageSchema.parse({
        ...usage,
        id: "usage_1",
        sessionId: "session_1",
        createdAt: "2026-07-17T12:00:00.000Z",
      }),
    );

    expect(usage).toMatchObject({
      inputTextTokens: 1_000,
      cachedInputTextTokens: 400,
      outputTextTokens: 200,
      latencyMs: 321.5,
    });
    expect(estimate.usd).toBeCloseTo(0.00184, 8);
    expect(estimate.asOf).toBe("2026-07-17");
  });

  it("round-trips session usage through SQLite", () => {
    const repository = new SqliteLearningRepository(":memory:");
    repository.saveLearner(
      LearnerProfileSchema.parse({
        id: "learner_1",
        phoneHash: "a".repeat(64),
        name: "Learner",
        preferredLanguage: "en",
        currentConcept: "fractions",
        lastMastery: "needs_support",
        createdAt: "2026-07-17T12:00:00.000Z",
        updatedAt: "2026-07-17T12:00:00.000Z",
      }),
    );
    repository.saveLesson(
      LessonSessionSchema.parse({
        id: "session_1",
        learnerId: "learner_1",
        concept: "fractions",
        status: "active",
        turnCount: 0,
        lastPrompt: "Which is bigger?",
        lastDiagnosis: "No evidence yet.",
        lastStrategy: "ask_reasoning",
        masteryStatus: "needs_support",
        masteryEvidence: "No evidence yet.",
        createdAt: "2026-07-17T12:00:00.000Z",
        updatedAt: "2026-07-17T12:00:00.000Z",
      }),
    );
    const stored = StoredModelUsageSchema.parse({
      id: "usage_1",
      sessionId: "session_1",
      source: "realtime",
      modelRoute: "gpt-realtime-2.1-mini",
      providerResponseId: "resp_123",
      inputTextTokens: 50,
      cachedInputTextTokens: 20,
      outputTextTokens: 10,
      inputAudioTokens: 100,
      cachedInputAudioTokens: 30,
      outputAudioTokens: 40,
      latencyMs: 842.5,
      createdAt: "2026-07-17T12:00:01.000Z",
    });

    repository.appendUsage(stored);
    expect(repository.listUsage("session_1")).toEqual([stored]);
    repository.close();
  });
});
