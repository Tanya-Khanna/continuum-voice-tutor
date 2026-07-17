import { fractionsPack } from "../../curriculum/fractions.pack.js";
import { voiceOutputFailures } from "../../domain/voice-output.js";
import { OfflineTeachingEngine } from "../../engine/offline-teaching-engine.js";
import type { TeachingEngine } from "../../engine/teaching-engine.js";
import { LessonService } from "../../lesson/lesson-service.js";
import { SqliteLearningRepository } from "../../persistence/sqlite-learning-repository.js";
import {
  OrchestrationArtifactSchema,
  type OrchestrationAgentEvalScenario,
  type OrchestrationArtifact,
} from "./schema.js";

const SYNTHETIC_PHONE = "+1 202 555 0100";
const PHONE_HASH_SECRET = "agent-eval-only-phone-hash-secret";

interface OrchestrationUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface OrchestrationAdapterResult {
  artifact: OrchestrationArtifact;
  teacherModel: string;
  usage: OrchestrationUsage;
}

interface AdapterOptions {
  liveEngine: TeachingEngine;
  simulatedUtterance: string;
}

function sequentialIds(): () => string {
  let counter = 0;
  return () => `agent-eval-id-${++counter}`;
}

function makeService(options?: {
  engine?: TeachingEngine;
  clock?: () => Date;
}): {
  repository: SqliteLearningRepository;
  service: LessonService;
} {
  const repository = new SqliteLearningRepository(":memory:");
  const engine = options?.engine ?? new OfflineTeachingEngine(fractionsPack);
  const service = new LessonService({
    repository,
    engine,
    curriculumPack: fractionsPack,
    phoneHashSecret: PHONE_HASH_SECRET,
    makeId: sequentialIds(),
    ...(options?.clock ? { clock: options.clock } : {}),
  });
  return { repository, service };
}

function check(id: string, passed: boolean, detail: string) {
  return { id, passed, detail };
}

function usageForSession(
  repository: SqliteLearningRepository,
  sessionId: string,
): OrchestrationUsage {
  return repository.listUsage(sessionId).reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTextTokens,
      outputTokens: total.outputTokens + usage.outputTextTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

function parsedArtifact(
  scenario: OrchestrationAgentEvalScenario,
  summary: string,
  checks: ReturnType<typeof check>[],
  observations: OrchestrationArtifact["observations"],
): OrchestrationArtifact {
  return OrchestrationArtifactSchema.parse({
    adapter: scenario.adapter,
    summary,
    checks,
    observations,
  });
}

async function disconnectPersistence(
  scenario: OrchestrationAgentEvalScenario,
): Promise<OrchestrationAdapterResult> {
  const { repository, service } = makeService();
  try {
    const started = service.beginOrResume({
      phoneNumber: SYNTHETIC_PHONE,
      learnerName: "Learner One",
    });
    const answered = await service.respond(
      started,
      "One fourth is bigger because four is bigger than three.",
    );
    const pendingPrompt = answered.context.session.lastPrompt;
    const paused = service.pause(answered.context);
    const persisted = repository.findLesson(paused.session.id);
    return {
      artifact: parsedArtifact(
        scenario,
        "A dropped active lesson was persisted as paused without losing its pending question.",
        [
          check("paused", persisted?.status === "paused", "The persisted session status must be paused."),
          check("same_session", persisted?.id === started.session.id, "The drop must not create a replacement session."),
          check("prompt_preserved", persisted?.lastPrompt === pendingPrompt, "The pending question must survive the disconnect."),
          check("turn_preserved", repository.listTurns(started.session.id).length === 1, "The completed turn must remain attached to the session."),
        ],
        { status: persisted?.status ?? "missing", turn_count: persisted?.turnCount ?? 0 },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

async function reconnectResume(
  scenario: OrchestrationAgentEvalScenario,
): Promise<OrchestrationAdapterResult> {
  const { repository, service } = makeService();
  try {
    const started = service.beginOrResume({
      phoneNumber: SYNTHETIC_PHONE,
      learnerName: "Learner One",
    });
    const answered = await service.respond(
      started,
      "One fourth is bigger because four is bigger than three.",
    );
    const paused = service.pause(answered.context);
    const resumed = service.beginOrResume({
      phoneNumber: SYNTHETIC_PHONE,
      learnerName: " learner one ",
    });
    return {
      artifact: parsedArtifact(
        scenario,
        "An immediate redial resumed the normalized named learner at the exact interrupted question.",
        [
          check("marked_resumed", resumed.resumed, "The returned context must be marked as resumed."),
          check("same_learner", resumed.learner.id === paused.learner.id, "Phone plus normalized name must select the same learner."),
          check("same_session", resumed.session.id === paused.session.id, "Immediate recovery must reuse the interrupted session."),
          check("exact_prompt", resumed.session.lastPrompt === paused.session.lastPrompt, "Immediate recovery must keep the exact pending question."),
        ],
        { resumed: resumed.resumed, turn_count: resumed.session.turnCount },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

function sharedPhoneSeparation(
  scenario: OrchestrationAgentEvalScenario,
): OrchestrationAdapterResult {
  const { repository, service } = makeService();
  try {
    const first = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Learner One" });
    const second = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Learner Two" });
    return {
      artifact: parsedArtifact(
        scenario,
        "Two names on one phone produced separate learner profiles and lesson sessions.",
        [
          check("learner_ids_separate", first.learner.id !== second.learner.id, "Each named learner must have a distinct profile ID."),
          check("session_ids_separate", first.session.id !== second.session.id, "Each named learner must have a distinct lesson session."),
          check("two_profiles", repository.listRecentLessons(10).length === 2, "Both isolated sessions must be persisted."),
        ],
        { learner_ids_distinct: first.learner.id !== second.learner.id, session_ids_distinct: first.session.id !== second.session.id },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

function sharedPhoneResume(
  scenario: OrchestrationAgentEvalScenario,
): OrchestrationAdapterResult {
  const { repository, service } = makeService();
  try {
    const first = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Learner One" });
    const second = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Learner Two" });
    const pausedFirst = service.pause(first);
    const resumedFirst = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "learner one" });
    const secondPersisted = repository.findLesson(second.session.id);
    return {
      artifact: parsedArtifact(
        scenario,
        "Returning with one sibling's normalized name resumed only that sibling's session.",
        [
          check("correct_learner", resumedFirst.learner.id === pausedFirst.learner.id, "The requested name must resolve to the first learner."),
          check("correct_session", resumedFirst.session.id === pausedFirst.session.id, "The first learner's paused session must resume."),
          check("other_not_selected", resumedFirst.learner.id !== second.learner.id, "The shared phone must not select the other learner."),
          check("other_unchanged", secondPersisted?.status === "active", "The other learner's session state must remain unchanged."),
        ],
        { resumed: resumedFirst.resumed, other_status: secondPersisted?.status ?? "missing" },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

async function placementAccuracy(
  scenario: OrchestrationAgentEvalScenario,
  engine: TeachingEngine,
): Promise<OrchestrationAdapterResult> {
  const { repository, service } = makeService({ engine });
  try {
    const context = service.beginOrResume({
      phoneNumber: SYNTHETIC_PHONE,
      learnerName: "Placement Learner",
      preferredLanguage: "es",
    });
    const completed = await service.completePlacement(context, [
      { questionId: "equal_shares", answer: "Cada persona recibe la mitad." },
      { questionId: "compare_halves_quarters", answer: "Un medio, porque hay menos partes y cada parte es más grande." },
      { questionId: "compare_thirds_fifths", answer: "Un tercio, porque con menos partes cada pedazo es más grande." },
    ]);
    const persisted = repository.findLearner(context.learner.id);
    return {
      artifact: parsedArtifact(
        scenario,
        "The model judged multilingual diagnostic meaning and trusted code derived and persisted the placement.",
        [
          check("all_answers_scored", completed.result.total === 3, "Every reviewed placement question must be scored."),
          check("grade_ready", completed.result.level === "grade_ready" && completed.result.score === 3, "Three semantically correct answers must produce grade-ready placement."),
          check("persisted", persisted?.placementLevel === "grade_ready" && persisted.placementScore === 3, "The derived result must persist on the named learner."),
          check("placement_cleared", !service.requiresPlacement(completed.context), "Guided teaching must no longer be placement-gated."),
        ],
        { level: completed.result.level, score: completed.result.score, total: completed.result.total },
      ),
      teacherModel: engine.modelRoute,
      usage: usageForSession(repository, context.session.id),
    };
  } finally {
    repository.close();
  }
}

async function callbackRetrieval(
  scenario: OrchestrationAgentEvalScenario,
): Promise<OrchestrationAdapterResult> {
  let now = new Date("2026-07-17T12:00:00.000Z");
  const { repository, service } = makeService({ clock: () => now });
  try {
    let context = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Returning Learner" });
    const answered = await service.respond(context, "One fourth is bigger because four is bigger than three.");
    context = service.pause(answered.context);
    const interruptedPrompt = context.session.lastPrompt;
    now = new Date("2026-07-17T12:16:00.000Z");
    const returned = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "returning learner" });
    const reviewedQuestions = fractionsPack.concepts.find((concept) => concept.id === returned.session.concept)?.retrievalQuestions ?? [];
    return {
      artifact: parsedArtifact(
        scenario,
        "A later return switched from exact drop recovery to a reviewed retrieval warm-up.",
        [
          check("retrieval_prompt", reviewedQuestions.includes(returned.session.lastPrompt), "The return prompt must come from the frozen pack's retrieval questions."),
          check("not_interrupted_prompt", returned.session.lastPrompt !== interruptedPrompt, "A later callback must not pretend to be an immediate drop recovery."),
          check("warmup_lead", returned.greeting.includes("warm up"), "The greeting must explain the retrieval warm-up."),
          check("same_session", returned.session.id === context.session.id, "The learner's persisted session must remain the source of continuity."),
        ],
        { resumed: returned.resumed, retrieval_question_reviewed: reviewedQuestions.includes(returned.session.lastPrompt) },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

function menuRouting(
  scenario: OrchestrationAgentEvalScenario,
  mode: "guided" | "curious_sandbox",
): OrchestrationAdapterResult {
  const { repository, service } = makeService();
  try {
    const context = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Menu Learner" });
    const before = repository.findLesson(context.session.id);
    const menu = service.learningMenu(context);
    const greeting = service.modeGreeting(context, mode);
    const after = repository.findLesson(context.session.id);
    const isGuided = mode === "guided";
    return {
      artifact: parsedArtifact(
        scenario,
        isGuided
          ? "The configured guided subject routed to the curriculum greeting."
          : "Curious Sandbox routed to its separate open-question greeting without changing lesson progress.",
        [
          check("subject_option", menu.includes(`guided ${fractionsPack.deployment.subject}`), "The menu must use deployment subject metadata."),
          check("sandbox_option", menu.includes("Curious Sandbox"), "The menu must expose Sandbox as a distinct option."),
          check("correct_greeting", isGuided ? greeting === context.greeting : greeting.includes("Curious Sandbox is open"), "The selected mode must return its authoritative greeting."),
          check("no_progress_change", before?.turnCount === after?.turnCount && before?.masteryStatus === after?.masteryStatus, "Menu routing must not advance lesson progress or mastery."),
        ],
        { selected_mode: mode, turn_count: after?.turnCount ?? -1 },
      ),
      teacherModel: "application-state-machine",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  } finally {
    repository.close();
  }
}

async function sandboxHedging(
  scenario: OrchestrationAgentEvalScenario,
  engine: TeachingEngine,
  simulatedUtterance: string,
): Promise<OrchestrationAdapterResult> {
  const { repository, service } = makeService({ engine });
  try {
    const context = service.beginOrResume({ phoneNumber: SYNTHETIC_PHONE, learnerName: "Sandbox Learner", preferredLanguage: "es+en" });
    const before = repository.findLesson(context.session.id);
    const turn = await service.exploreSandbox(context, simulatedUtterance);
    const after = repository.findLesson(context.session.id);
    const questionCount = turn.spoken_response.match(/[?？؟]/gu)?.length ?? 0;
    return {
      artifact: parsedArtifact(
        scenario,
        "The separate Sandbox contract hedged a current-information question and preserved guided progress.",
        [
          check("low_certainty", turn.certainty === "low", "An unverifiable current-information answer must be low certainty."),
          check("safe", turn.safety_status === "safe", "A benign current-information question must remain safe."),
          check("language_match", turn.language_mode.split("+").includes("es") && turn.language_mode.split("+").includes("en"), "The Sandbox result must preserve the reviewed Spanish-English mode."),
          check("one_follow_up", questionCount === 1 && turn.follow_up_question.length > 0, "The spoken response must contain one Socratic follow-up."),
          check("guided_unchanged", before?.turnCount === after?.turnCount && before?.masteryStatus === after?.masteryStatus, "Sandbox must not change guided progress or mastery."),
        ],
        { certainty: turn.certainty, safety_status: turn.safety_status, spoken_question_count: questionCount },
      ),
      teacherModel: engine.modelRoute,
      usage: usageForSession(repository, context.session.id),
    };
  } finally {
    repository.close();
  }
}

async function voiceMathFormat(
  scenario: OrchestrationAgentEvalScenario,
  engine: TeachingEngine,
  simulatedUtterance: string,
): Promise<OrchestrationAdapterResult> {
  const result = await engine.teach({
    learnerId: `synthetic-agent-${scenario.id}`,
    concept: fractionsPack.concepts[0]!.id,
    learnerAnswer: simulatedUtterance,
    requestedLanguageMode: "auto",
    lessonState: {
      turnNumber: 1,
      targetTurns: fractionsPack.lessonPolicy.targetTurns,
      phase: "explore",
      previousPrompt: fractionsPack.concepts[0]!.teachingScaffold.entryQuestion,
      previousDiagnosis: "No evidence yet.",
      priorReasoningEvidenceCount: 0,
      consecutiveSafetyRedirects: 0,
      anchorObject: null,
      placementLevel: "developing",
    },
  });
  const failures = voiceOutputFailures(result.value);
  const spokenQuestions = result.value.spoken_response.match(/[?？؟]/gu)?.length ?? 0;
  const spokenSentences = result.value.spoken_response
    .split(/[.!?。！？।؟]+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
  return {
    artifact: parsedArtifact(
      scenario,
      "The production teaching contract returned a voice-native mathematical turn.",
      [
        check("voice_policy", failures.length === 0, failures.length === 0 ? "The shared voice-output policy accepted the turn." : failures.join("; ")),
        check("one_question", spokenQuestions === 1, "An active spoken teaching turn must contain exactly one question."),
        check("short_response", spokenSentences <= 3, "The spoken response must contain at most three short sentences."),
        check("speakable_fraction", !/\d+\s*\/\s*\d+|[¼½¾⅐-⅞]/u.test(`${result.value.spoken_response} ${result.value.next_question}`), "Math must use speakable fraction names rather than symbolic notation."),
        check("context_preserved", result.value.concept === fractionsPack.concepts[0]!.id && result.value.learner_answer === simulatedUtterance, "The turn must preserve the supplied concept and learner answer."),
        check("misconception_handled", ["concrete_analogy", "contrast_cases"].includes(result.value.next_strategy), "The denominator misconception must receive a reviewed conceptual strategy."),
      ],
      { spoken_question_count: spokenQuestions, spoken_sentence_count: spokenSentences, voice_failure_count: failures.length, language_mode: result.value.language_mode },
    ),
    teacherModel: engine.modelRoute,
    usage: {
      inputTokens: result.usage?.inputTextTokens ?? 0,
      outputTokens: result.usage?.outputTextTokens ?? 0,
    },
  };
}

export async function runOrchestrationAdapter(
  scenario: OrchestrationAgentEvalScenario,
  options: AdapterOptions,
): Promise<OrchestrationAdapterResult> {
  switch (scenario.adapter) {
    case "disconnect_persistence":
      return disconnectPersistence(scenario);
    case "reconnect_resume":
      return reconnectResume(scenario);
    case "shared_phone_separation":
      return sharedPhoneSeparation(scenario);
    case "shared_phone_resume":
      return sharedPhoneResume(scenario);
    case "placement_accuracy":
      return placementAccuracy(scenario, options.liveEngine);
    case "callback_retrieval":
      return callbackRetrieval(scenario);
    case "menu_guided":
      return menuRouting(scenario, "guided");
    case "menu_sandbox":
      return menuRouting(scenario, "curious_sandbox");
    case "sandbox_hedging":
      return sandboxHedging(scenario, options.liveEngine, options.simulatedUtterance);
    case "voice_math_format":
      return voiceMathFormat(scenario, options.liveEngine, options.simulatedUtterance);
  }
}
