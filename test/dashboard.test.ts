import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { buildDashboardSnapshot } from "../src/observability/dashboard.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { StoredModelUsageSchema } from "../src/domain/usage.js";
import { DASHBOARD_HTML } from "../src/dashboard/page.js";

describe("mission-control snapshot", () => {
  it("keeps a judge token out of the request URL and sends it only as authorization", () => {
    expect(DASHBOARD_HTML).toContain("window.location.hash.slice(1)");
    expect(DASHBOARD_HTML).toContain("window.sessionStorage");
    expect(DASHBOARD_HTML).toContain(
      "Authorization: 'Bearer ' + dashboardToken",
    );
    expect(DASHBOARD_HTML).not.toContain("searchParams.get('token')");
  });

  it("exposes teaching evidence without learner names or phone numbers", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new LessonService({
      repository,
      engine: new OfflineTeachingEngine(fractionsPack),
      phoneHashSecret: "dashboard-test-secret-12345",
      curriculumPack: fractionsPack,
    });
    const context = service.beginOrResume({
      phoneNumber: "+919999988888",
      learnerName: "Private Learner Name",
    });
    await service.respond(
      context,
      "One fourth is bigger because four is bigger than three.",
    );
    repository.appendUsage(
      StoredModelUsageSchema.parse({
        id: "usage_dashboard",
        sessionId: context.session.id,
        source: "realtime",
        modelRoute: "gpt-realtime-2.1-mini",
        providerResponseId: "resp_dashboard",
        inputTextTokens: 70,
        cachedInputTextTokens: 20,
        outputTextTokens: 30,
        inputAudioTokens: 100,
        cachedInputAudioTokens: 30,
        outputAudioTokens: 40,
        latencyMs: 840,
        createdAt: "2026-07-17T11:59:00.000Z",
      }),
    );

    const snapshot = buildDashboardSnapshot({
      repository,
      curriculumPack: fractionsPack,
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]).toMatchObject({
      learner_ref: expect.stringMatching(/^learner_[a-f0-9]{10}$/u),
      curriculum_pack_id: fractionsPack.id,
      subject: "Math",
      turn_count: 1,
      anchor_object: null,
      placement: {
        level: "unplaced",
        score: 0,
        total: 0,
        evidence: [],
      },
      usage: expect.objectContaining({
        request_count: 1,
        total_tokens: 240,
        estimated_cost_usd: expect.any(Number),
        pricing_as_of: "2026-07-17",
        unpriced_models: [],
        measured_latency_count: 1,
        average_latency_ms: 840,
        maximum_latency_ms: 840,
      }),
      turns: [
        expect.objectContaining({
          model_route: "offline",
          next_strategy: "concrete_analogy",
          anchor_object: null,
          reasoning_trace: expect.arrayContaining([
            expect.objectContaining({
              source: "learner_stated",
              status: "unsupported",
            }),
          ]),
        }),
      ],
    });
    expect(serialized).not.toContain("Private Learner Name");
    expect(serialized).not.toContain("+919999988888");
    repository.close();
  });
});
