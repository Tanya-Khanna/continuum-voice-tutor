import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { OfflineTeachingEngine } from "../src/engine/offline-teaching-engine.js";
import { LessonService } from "../src/lesson/lesson-service.js";
import { buildDashboardSnapshot } from "../src/observability/dashboard.js";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";
import { StoredModelUsageSchema } from "../src/domain/usage.js";
import { DASHBOARD_HTML } from "../src/dashboard/page.js";
import { OfflineOpenTopicEngine } from "../src/engine/offline-open-topic-engine.js";
import { OpenTopicLessonService } from "../src/lesson/open-topic-lesson-service.js";

describe("mission-control snapshot", () => {
  it("uses the Continuum brand in learner-visible Mission Control copy", () => {
    expect(DASHBOARD_HTML).toContain("<title>Continuum Mission Control</title>");
    expect(DASHBOARD_HTML).toContain("Continuum / Mission Control");
    expect(DASHBOARD_HTML).not.toContain("Nomad");
  });

  it("keeps a judge token out of the request URL and sends it only as authorization", () => {
    expect(DASHBOARD_HTML).toContain("window.location.hash.slice(1)");
    expect(DASHBOARD_HTML).toContain("window.sessionStorage");
    expect(DASHBOARD_HTML).toContain(
      "Authorization: 'Bearer ' + dashboardToken",
    );
    expect(DASHBOARD_HTML).not.toContain("searchParams.get('token')");
  });

  it("keeps successful agent evidence compact without hiding failures", () => {
    expect(DASHBOARD_HTML).toContain(".eval-row > *");
    expect(DASHBOARD_HTML).toContain("document.createElement('details')");
    expect(DASHBOARD_HTML).toContain("View evaluator note");
    expect(DASHBOARD_HTML).toContain("if (failures.length > 0)");
  });

  it("humanizes learner-state enums while preserving audit fields", () => {
    expect(DASHBOARD_HTML).toContain("const humanize = (value)");
    expect(DASHBOARD_HTML).toContain("humanize(session.mastery_status)");
    expect(DASHBOARD_HTML).toContain("humanize(latest.next_strategy)");
    expect(DASHBOARD_HTML).toContain("latest?.model_route ?? 'pending'");
    expect(DASHBOARD_HTML).toContain("latest?.language_mode ?? 'pending'");
  });

  it("renders a secret-safe browser release checklist behind dashboard auth", () => {
    expect(DASHBOARD_HTML).toContain("/api/dashboard/readiness");
    expect(DASHBOARD_HTML).toContain("report.readyCount + '/' + report.totalCount");
    expect(DASHBOARD_HTML).toContain("One controlled smoke call is allowed.");
    expect(DASHBOARD_HTML).toContain("no credential values are displayed");
    expect(DASHBOARD_HTML).toContain("Public number', 'Still gated");
  });

  it("makes access, reliability, and learning evidence visible to judges", () => {
    expect(DASHBOARD_HTML).toContain("id=\"metrics-tab\"");
    expect(DASHBOARD_HTML).toContain("/api/dashboard/product-metrics");
    expect(DASHBOARD_HTML).toContain("Access. Reliability. Learning.");
    expect(DASHBOARD_HTML).toContain("state.metrics.evidenceScope");
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

  it("renders open-topic proof without requiring a curriculum pack", async () => {
    const repository = new SqliteLearningRepository(":memory:");
    const service = new OpenTopicLessonService({
      repository,
      engine: new OfflineOpenTopicEngine(),
      phoneHashSecret: "dashboard-open-topic-secret",
    });
    const learner = service.identifyLearner({
      phoneNumber: "+14155550123",
      learnerName: "Open Topic Learner",
      preferredLanguage: "en",
    });
    const context = service.beginOrResumeLearner(learner);
    await service.respond(context, "Why do shadows change length?");

    const snapshot = buildDashboardSnapshot({
      repository,
      now: new Date("2026-07-21T12:00:00.000Z"),
    });
    expect(snapshot.sessions[0]).toMatchObject({
      curriculum_pack_id: "continuum-open-topic-v1",
      subject: "Open learning",
      concept_title: "Why do shadows change length?",
      placement: { level: "unplaced" },
      turns: [
        expect.objectContaining({
          mode: "open_topic",
          activity_kind: "socratic_prompt",
          evidence_kind: "diagnostic",
          evidence_result: "unclear",
          knowledge_state: "stable",
        }),
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain("Open Topic Learner");
    expect(JSON.stringify(snapshot)).not.toContain("+14155550123");
    repository.close();
  });
});
