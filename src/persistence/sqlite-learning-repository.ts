import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { normalizeLearnerName } from "../domain/identity.js";
import {
  LearnerProfileSchema,
  LessonSessionSchema,
  StoredTeachingTurnSchema,
  type LearnerProfile,
  type LearningRepository,
  type LessonSession,
  type StoredTeachingTurn,
} from "../domain/learner.js";
import {
  StoredModelUsageSchema,
  type StoredModelUsage,
} from "../domain/usage.js";
import {
  StoredSandboxTurnSchema,
  type StoredSandboxTurn,
} from "../domain/sandbox.js";
import {
  CuriosityTrailSchema,
  LearnerEducationProfileSchema,
  LearningEvidenceSchema,
  PedagogyDecisionSchema,
  TeachingFeedbackSchema,
  type CuriosityTrail,
  type LearnerEducationProfile,
  type LearningEvidence,
  type PedagogyDecision,
  type TeachingFeedback,
} from "../domain/classroom.js";
import {
  LearnerAccessCodeSchema,
  LearnerCodeAttemptSchema,
  type LearnerAccessCode,
  type LearnerCodeAttempt,
} from "../domain/portable-identity.js";
import { CallbackJobSchema, type CallbackJob } from "../domain/callback.js";
import {
  GuardianAuthorizationSchema,
  type GuardianAuthorization,
} from "../domain/guardian.js";
import { StudyPlanSchema, type StudyPlan } from "../domain/study-plan.js";
import { SmsReceiptSchema, type SmsReceipt } from "../domain/sms-control.js";
import {
  ProductMetricEventSchema,
  type ProductMetricEvent,
} from "../domain/product-metrics.js";
import {
  HomeworkAssignmentSchema,
  type HomeworkAssignment,
} from "../domain/homework.js";
import {
  CarrierCallReceiptSchema,
  type CarrierCallReceipt,
} from "../domain/carrier-usage.js";

interface LearnerRow {
  id: string;
  phone_hash: string;
  name: string;
  preferred_language: string;
  current_concept: string;
  last_mastery: string;
  placement_level: string;
  placement_score: number;
  placement_total: number;
  placement_evidence: string;
  created_at: string;
  updated_at: string;
}

interface LessonRow {
  id: string;
  learner_id: string;
  curriculum_pack_id: string;
  concept: string;
  status: string;
  turn_count: number;
  last_prompt: string;
  last_diagnosis: string;
  last_strategy: string;
  mastery_status: string;
  mastery_evidence: string;
  placement_level: string;
  placement_score: number;
  placement_total: number;
  placement_evidence: string;
  anchor_object: string | null;
  duration_minutes: number;
  access_mode: string;
  created_at: string;
  updated_at: string;
}

interface TurnRow {
  id: string;
  session_id: string;
  sequence: number;
  turn_json: string;
  model_route: string;
  created_at: string;
}

interface UsageRow {
  id: string;
  session_id: string;
  source: string;
  model_route: string;
  provider_response_id: string | null;
  input_text_tokens: number;
  cached_input_text_tokens: number;
  output_text_tokens: number;
  input_audio_tokens: number;
  cached_input_audio_tokens: number;
  output_audio_tokens: number;
  latency_ms: number | null;
  created_at: string;
}

interface SandboxTurnRow {
  id: string;
  session_id: string;
  sequence: number;
  turn_json: string;
  model_route: string;
  created_at: string;
}

function learnerFromRow(row: LearnerRow): LearnerProfile {
  return LearnerProfileSchema.parse({
    id: row.id,
    phoneHash: row.phone_hash,
    name: row.name,
    preferredLanguage: row.preferred_language,
    currentConcept: row.current_concept,
    lastMastery: row.last_mastery,
    placementLevel: row.placement_level,
    placementScore: row.placement_score,
    placementTotal: row.placement_total,
    placementEvidence: JSON.parse(row.placement_evidence) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function lessonFromRow(row: LessonRow): LessonSession {
  return LessonSessionSchema.parse({
    id: row.id,
    learnerId: row.learner_id,
    curriculumPackId: row.curriculum_pack_id,
    concept: row.concept,
    status: row.status,
    turnCount: row.turn_count,
    lastPrompt: row.last_prompt,
    lastDiagnosis: row.last_diagnosis,
    lastStrategy: row.last_strategy,
    masteryStatus: row.mastery_status,
    masteryEvidence: row.mastery_evidence,
    placementLevel: row.placement_level,
    placementScore: row.placement_score,
    placementTotal: row.placement_total,
    placementEvidence: JSON.parse(row.placement_evidence) as unknown,
    anchorObject: row.anchor_object,
    durationMinutes: row.duration_minutes,
    accessMode: row.access_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SqliteLearningRepository implements LearningRepository {
  readonly #database: Database.Database;

  constructor(path = ".data/nomad.db") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#database = new Database(path);
    this.#database.pragma("foreign_keys = ON");
    this.#database.pragma("journal_mode = WAL");
    this.#migrate();
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS learners (
        id TEXT PRIMARY KEY,
        phone_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        preferred_language TEXT NOT NULL,
        current_concept TEXT NOT NULL,
        last_mastery TEXT NOT NULL,
        placement_level TEXT NOT NULL DEFAULT 'unplaced',
        placement_score INTEGER NOT NULL DEFAULT 0,
        placement_total INTEGER NOT NULL DEFAULT 0,
        placement_evidence TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(phone_hash, normalized_name)
      );

      CREATE INDEX IF NOT EXISTS learners_phone_hash_idx
        ON learners(phone_hash);

      CREATE TABLE IF NOT EXISTS lesson_sessions (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id),
        curriculum_pack_id TEXT NOT NULL DEFAULT 'legacy',
        concept TEXT NOT NULL,
        status TEXT NOT NULL,
        turn_count INTEGER NOT NULL,
        last_prompt TEXT NOT NULL,
        last_diagnosis TEXT NOT NULL,
        last_strategy TEXT NOT NULL,
        mastery_status TEXT NOT NULL,
        mastery_evidence TEXT NOT NULL,
        placement_level TEXT NOT NULL DEFAULT 'unplaced',
        placement_score INTEGER NOT NULL DEFAULT 0,
        placement_total INTEGER NOT NULL DEFAULT 0,
        placement_evidence TEXT NOT NULL DEFAULT '[]',
        anchor_object TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 5,
        access_mode TEXT NOT NULL DEFAULT 'unknown',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS lessons_learner_status_idx
        ON lesson_sessions(learner_id, status, updated_at);

      CREATE TABLE IF NOT EXISTS teaching_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id),
        sequence INTEGER NOT NULL,
        turn_json TEXT NOT NULL,
        model_route TEXT NOT NULL DEFAULT 'unknown',
        created_at TEXT NOT NULL,
        UNIQUE(session_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS model_usage (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id),
        source TEXT NOT NULL,
        model_route TEXT NOT NULL,
        provider_response_id TEXT,
        input_text_tokens INTEGER NOT NULL,
        cached_input_text_tokens INTEGER NOT NULL,
        output_text_tokens INTEGER NOT NULL,
        input_audio_tokens INTEGER NOT NULL,
        cached_input_audio_tokens INTEGER NOT NULL,
        output_audio_tokens INTEGER NOT NULL,
        latency_ms REAL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS model_usage_session_idx
        ON model_usage(session_id, created_at);

      CREATE TABLE IF NOT EXISTS sandbox_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id),
        sequence INTEGER NOT NULL,
        turn_json TEXT NOT NULL,
        model_route TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(session_id, sequence)
      );

      CREATE INDEX IF NOT EXISTS sandbox_turns_session_idx
        ON sandbox_turns(session_id, sequence);

      CREATE TABLE IF NOT EXISTS learning_evidence (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS learning_evidence_learner_idx
        ON learning_evidence(learner_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS teaching_feedback (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
        feedback_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS teaching_feedback_learner_idx
        ON teaching_feedback(learner_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS pedagogy_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
        decision_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS pedagogy_decisions_session_idx
        ON pedagogy_decisions(session_id, id);

      CREATE TABLE IF NOT EXISTS education_profiles (
        learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
        profile_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS curiosity_trails (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        trail_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS curiosity_trails_learner_idx
        ON curiosity_trails(learner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS learner_access_codes (
        learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
        code_fingerprint TEXT NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        rotated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS learner_code_attempts (
        id TEXT PRIMARY KEY,
        code_fingerprint TEXT NOT NULL,
        source_phone_hash TEXT NOT NULL,
        succeeded INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS learner_code_attempts_rate_idx
        ON learner_code_attempts(source_phone_hash, code_fingerprint, created_at DESC);

      CREATE TABLE IF NOT EXISTS callback_jobs (
        id TEXT PRIMARY KEY,
        source_call_sid TEXT NOT NULL UNIQUE,
        caller_phone_hash TEXT NOT NULL,
        encrypted_caller_number TEXT NOT NULL,
        access_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        claim_token TEXT,
        claim_expires_at TEXT,
        provider_call_sid TEXT,
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS callback_jobs_caller_created_idx
        ON callback_jobs(caller_phone_hash, created_at DESC);

      CREATE INDEX IF NOT EXISTS callback_jobs_status_idx
        ON callback_jobs(status, created_at);

      CREATE TABLE IF NOT EXISTS carrier_call_receipts (
        id TEXT PRIMARY KEY,
        provider_call_sid TEXT UNIQUE,
        receipt_json TEXT NOT NULL,
        status TEXT NOT NULL,
        price_amount REAL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS carrier_call_receipts_status_idx
        ON carrier_call_receipts(status, price_amount, updated_at);

      CREATE TABLE IF NOT EXISTS guardian_authorizations (
        learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
        guardian_phone_hash TEXT NOT NULL,
        code_fingerprint TEXT NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        sms_allowed INTEGER NOT NULL,
        proactive_calls_allowed INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_plans (
        learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
        plan_json TEXT NOT NULL,
        next_scheduled_call TEXT,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS study_plans_due_idx
        ON study_plans(status, next_scheduled_call);

      CREATE TABLE IF NOT EXISTS inbound_sms_receipts (
        message_sid TEXT PRIMARY KEY,
        learner_id TEXT,
        action TEXT NOT NULL,
        response_text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS inbound_sms_delete_idx
        ON inbound_sms_receipts(learner_id, action, created_at DESC);

      CREATE TABLE IF NOT EXISTS homework_assignments (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        assignment_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS homework_assignments_learner_idx
        ON homework_assignments(learner_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS product_metric_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        learner_id TEXT,
        session_id TEXT,
        event_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS product_metric_events_name_idx
        ON product_metric_events(name, created_at DESC);
    `);
    const turnColumns = this.#database.pragma(
      "table_info(teaching_turns)",
    ) as { name: string }[];
    if (!turnColumns.some((column) => column.name === "model_route")) {
      this.#database.exec(
        "ALTER TABLE teaching_turns ADD COLUMN model_route TEXT NOT NULL DEFAULT 'unknown'",
      );
    }
    const lessonColumns = this.#database.pragma(
      "table_info(lesson_sessions)",
    ) as { name: string }[];
    if (!lessonColumns.some((column) => column.name === "anchor_object")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN anchor_object TEXT",
      );
    }
    if (!lessonColumns.some((column) => column.name === "duration_minutes")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 5",
      );
    }
    if (!lessonColumns.some((column) => column.name === "access_mode")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'unknown'",
      );
    }
    if (!lessonColumns.some((column) => column.name === "curriculum_pack_id")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN curriculum_pack_id TEXT NOT NULL DEFAULT 'legacy'",
      );
    }
    const addedSessionPlacement = !lessonColumns.some(
      (column) => column.name === "placement_level",
    );
    if (addedSessionPlacement) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN placement_level TEXT NOT NULL DEFAULT 'unplaced'",
      );
    }
    if (!lessonColumns.some((column) => column.name === "placement_score")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN placement_score INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!lessonColumns.some((column) => column.name === "placement_total")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN placement_total INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!lessonColumns.some((column) => column.name === "placement_evidence")) {
      this.#database.exec(
        "ALTER TABLE lesson_sessions ADD COLUMN placement_evidence TEXT NOT NULL DEFAULT '[]'",
      );
    }
    const learnerColumns = this.#database.pragma(
      "table_info(learners)",
    ) as { name: string }[];
    if (!learnerColumns.some((column) => column.name === "placement_level")) {
      this.#database.exec(
        "ALTER TABLE learners ADD COLUMN placement_level TEXT NOT NULL DEFAULT 'unplaced'",
      );
    }
    if (!learnerColumns.some((column) => column.name === "placement_score")) {
      this.#database.exec(
        "ALTER TABLE learners ADD COLUMN placement_score INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!learnerColumns.some((column) => column.name === "placement_total")) {
      this.#database.exec(
        "ALTER TABLE learners ADD COLUMN placement_total INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!learnerColumns.some((column) => column.name === "placement_evidence")) {
      this.#database.exec(
        "ALTER TABLE learners ADD COLUMN placement_evidence TEXT NOT NULL DEFAULT '[]'",
      );
    }
    if (addedSessionPlacement) {
      this.#database.exec(`
        UPDATE lesson_sessions
        SET placement_level = COALESCE(
              (SELECT placement_level FROM learners WHERE learners.id = lesson_sessions.learner_id),
              'unplaced'
            ),
            placement_score = COALESCE(
              (SELECT placement_score FROM learners WHERE learners.id = lesson_sessions.learner_id),
              0
            ),
            placement_total = COALESCE(
              (SELECT placement_total FROM learners WHERE learners.id = lesson_sessions.learner_id),
              0
            ),
            placement_evidence = COALESCE(
              (SELECT placement_evidence FROM learners WHERE learners.id = lesson_sessions.learner_id),
              '[]'
            )
      `);
    }
    this.#database.exec(`
      CREATE INDEX IF NOT EXISTS lessons_learner_pack_status_idx
        ON lesson_sessions(learner_id, curriculum_pack_id, status, updated_at)
    `);
    const usageColumns = this.#database.pragma(
      "table_info(model_usage)",
    ) as { name: string }[];
    if (!usageColumns.some((column) => column.name === "latency_ms")) {
      this.#database.exec("ALTER TABLE model_usage ADD COLUMN latency_ms REAL");
    }
  }

  findLearner(id: string): LearnerProfile | undefined {
    const row = this.#database
      .prepare("SELECT * FROM learners WHERE id = ?")
      .get(id) as LearnerRow | undefined;
    return row ? learnerFromRow(row) : undefined;
  }

  listLearnersForPhone(phoneHash: string): LearnerProfile[] {
    const rows = this.#database
      .prepare("SELECT * FROM learners WHERE phone_hash = ? ORDER BY created_at")
      .all(phoneHash) as LearnerRow[];
    return rows.map(learnerFromRow);
  }

  saveLearner(profile: LearnerProfile): void {
    const learner = LearnerProfileSchema.parse(profile);
    this.#database
      .prepare(
        `INSERT INTO learners (
          id, phone_hash, name, normalized_name, preferred_language,
          current_concept, last_mastery, created_at, updated_at,
          placement_level, placement_score, placement_total, placement_evidence
        ) VALUES (
          @id, @phoneHash, @name, @normalizedName, @preferredLanguage,
          @currentConcept, @lastMastery, @createdAt, @updatedAt,
          @placementLevel, @placementScore, @placementTotal, @placementEvidenceJson
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          normalized_name = excluded.normalized_name,
          preferred_language = excluded.preferred_language,
          current_concept = excluded.current_concept,
          last_mastery = excluded.last_mastery,
          placement_level = excluded.placement_level,
          placement_score = excluded.placement_score,
          placement_total = excluded.placement_total,
          placement_evidence = excluded.placement_evidence,
          updated_at = excluded.updated_at`,
      )
      .run({
        ...learner,
        normalizedName: normalizeLearnerName(learner.name),
        placementEvidenceJson: JSON.stringify(learner.placementEvidence),
      });
  }

  findResumableLesson(
    learnerId: string,
    curriculumPackId?: string,
    includeLegacy = false,
  ): LessonSession | undefined {
    const packClause = curriculumPackId
      ? includeLegacy
        ? "AND curriculum_pack_id IN (?, 'legacy')"
        : "AND curriculum_pack_id = ?"
      : "";
    const parameters = curriculumPackId
      ? [learnerId, curriculumPackId]
      : [learnerId];
    const row = this.#database
      .prepare(
        `SELECT * FROM lesson_sessions
         WHERE learner_id = ? ${packClause} AND status IN ('active', 'paused')
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(...parameters) as LessonRow | undefined;
    return row ? lessonFromRow(row) : undefined;
  }

  findLatestLesson(
    learnerId: string,
    curriculumPackId?: string,
    includeLegacy = false,
  ): LessonSession | undefined {
    const packClause = curriculumPackId
      ? includeLegacy
        ? "AND curriculum_pack_id IN (?, 'legacy')"
        : "AND curriculum_pack_id = ?"
      : "";
    const parameters = curriculumPackId
      ? [learnerId, curriculumPackId]
      : [learnerId];
    const row = this.#database
      .prepare(
        `SELECT * FROM lesson_sessions
         WHERE learner_id = ? ${packClause}
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(...parameters) as LessonRow | undefined;
    return row ? lessonFromRow(row) : undefined;
  }

  findLesson(id: string): LessonSession | undefined {
    const row = this.#database
      .prepare("SELECT * FROM lesson_sessions WHERE id = ?")
      .get(id) as LessonRow | undefined;
    return row ? lessonFromRow(row) : undefined;
  }

  listRecentLessons(limit: number): LessonSession[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        "SELECT * FROM lesson_sessions ORDER BY updated_at DESC LIMIT ?",
      )
      .all(safeLimit) as LessonRow[];
    return rows.map(lessonFromRow);
  }

  saveLesson(session: LessonSession): void {
    const lesson = LessonSessionSchema.parse(session);
    this.#database
      .prepare(
        `INSERT INTO lesson_sessions (
          id, learner_id, curriculum_pack_id, concept, status, turn_count, last_prompt,
          last_diagnosis, last_strategy, mastery_status, mastery_evidence,
          placement_level, placement_score, placement_total, placement_evidence,
          anchor_object, duration_minutes, access_mode, created_at, updated_at
        ) VALUES (
          @id, @learnerId, @curriculumPackId, @concept, @status, @turnCount, @lastPrompt,
          @lastDiagnosis, @lastStrategy, @masteryStatus, @masteryEvidence,
          @placementLevel, @placementScore, @placementTotal, @placementEvidenceJson,
          @anchorObject, @durationMinutes, @accessMode, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          curriculum_pack_id = excluded.curriculum_pack_id,
          concept = excluded.concept,
          status = excluded.status,
          turn_count = excluded.turn_count,
          last_prompt = excluded.last_prompt,
          last_diagnosis = excluded.last_diagnosis,
          last_strategy = excluded.last_strategy,
          mastery_status = excluded.mastery_status,
          mastery_evidence = excluded.mastery_evidence,
          placement_level = excluded.placement_level,
          placement_score = excluded.placement_score,
          placement_total = excluded.placement_total,
          placement_evidence = excluded.placement_evidence,
          anchor_object = excluded.anchor_object,
          duration_minutes = excluded.duration_minutes,
          access_mode = excluded.access_mode,
          updated_at = excluded.updated_at`,
      )
      .run({
        ...lesson,
        placementEvidenceJson: JSON.stringify(lesson.placementEvidence),
      });
  }

  appendTurn(storedTurn: StoredTeachingTurn): void {
    const entry = StoredTeachingTurnSchema.parse(storedTurn);
    this.#database
      .prepare(
        `INSERT INTO teaching_turns (
          id, session_id, sequence, turn_json, model_route, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.sessionId,
        entry.sequence,
        JSON.stringify(entry.turn),
        entry.modelRoute,
        entry.createdAt,
      );
  }

  listTurns(sessionId: string): StoredTeachingTurn[] {
    const rows = this.#database
      .prepare(
        "SELECT * FROM teaching_turns WHERE session_id = ? ORDER BY sequence",
      )
      .all(sessionId) as TurnRow[];
    return rows.map((row) =>
      StoredTeachingTurnSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        sequence: row.sequence,
        turn: JSON.parse(row.turn_json) as unknown,
        modelRoute: row.model_route,
        createdAt: row.created_at,
      }),
    );
  }

  appendSandboxTurn(unparsedTurn: StoredSandboxTurn): void {
    const entry = StoredSandboxTurnSchema.parse(unparsedTurn);
    this.#database
      .prepare(
        `INSERT INTO sandbox_turns (
          id, session_id, sequence, turn_json, model_route, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.sessionId,
        entry.sequence,
        JSON.stringify(entry.turn),
        entry.modelRoute,
        entry.createdAt,
      );
  }

  listSandboxTurns(sessionId: string): StoredSandboxTurn[] {
    const rows = this.#database
      .prepare(
        "SELECT * FROM sandbox_turns WHERE session_id = ? ORDER BY sequence",
      )
      .all(sessionId) as SandboxTurnRow[];
    return rows.map((row) =>
      StoredSandboxTurnSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        sequence: row.sequence,
        turn: JSON.parse(row.turn_json) as unknown,
        modelRoute: row.model_route,
        createdAt: row.created_at,
      }),
    );
  }

  appendUsage(unparsedUsage: StoredModelUsage): void {
    const usage = StoredModelUsageSchema.parse(unparsedUsage);
    this.#database
      .prepare(
        `INSERT INTO model_usage (
          id, session_id, source, model_route, provider_response_id,
          input_text_tokens, cached_input_text_tokens, output_text_tokens,
          input_audio_tokens, cached_input_audio_tokens, output_audio_tokens,
          latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        usage.id,
        usage.sessionId,
        usage.source,
        usage.modelRoute,
        usage.providerResponseId ?? null,
        usage.inputTextTokens,
        usage.cachedInputTextTokens,
        usage.outputTextTokens,
        usage.inputAudioTokens,
        usage.cachedInputAudioTokens,
        usage.outputAudioTokens,
        usage.latencyMs ?? null,
        usage.createdAt,
      );
  }

  listUsage(sessionId: string): StoredModelUsage[] {
    const rows = this.#database
      .prepare(
        "SELECT * FROM model_usage WHERE session_id = ? ORDER BY created_at, id",
      )
      .all(sessionId) as UsageRow[];
    return rows.map((row) =>
      StoredModelUsageSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        source: row.source,
        modelRoute: row.model_route,
        ...(row.provider_response_id
          ? { providerResponseId: row.provider_response_id }
          : {}),
        inputTextTokens: row.input_text_tokens,
        cachedInputTextTokens: row.cached_input_text_tokens,
        outputTextTokens: row.output_text_tokens,
        inputAudioTokens: row.input_audio_tokens,
        cachedInputAudioTokens: row.cached_input_audio_tokens,
        outputAudioTokens: row.output_audio_tokens,
        ...(row.latency_ms === null ? {} : { latencyMs: row.latency_ms }),
        createdAt: row.created_at,
      }),
    );
  }

  listAllUsage(limit = 50_000): StoredModelUsage[] {
    const safeLimit = Math.max(1, Math.min(100_000, Math.trunc(limit)));
    const rows = this.#database
      .prepare("SELECT * FROM model_usage ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(safeLimit) as UsageRow[];
    return rows.map((row) =>
      StoredModelUsageSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        source: row.source,
        modelRoute: row.model_route,
        ...(row.provider_response_id
          ? { providerResponseId: row.provider_response_id }
          : {}),
        inputTextTokens: row.input_text_tokens,
        cachedInputTextTokens: row.cached_input_text_tokens,
        outputTextTokens: row.output_text_tokens,
        inputAudioTokens: row.input_audio_tokens,
        cachedInputAudioTokens: row.cached_input_audio_tokens,
        outputAudioTokens: row.output_audio_tokens,
        ...(row.latency_ms === null ? {} : { latencyMs: row.latency_ms }),
        createdAt: row.created_at,
      }),
    );
  }

  appendLearningEvidence(unparsedEvidence: LearningEvidence): void {
    const evidence = LearningEvidenceSchema.parse(unparsedEvidence);
    this.#database
      .prepare(
        `INSERT INTO learning_evidence (
          id, learner_id, session_id, evidence_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        evidence.id,
        evidence.learnerId,
        evidence.sessionId,
        JSON.stringify(evidence),
        evidence.createdAt,
      );
  }

  listLearningEvidence(learnerId: string, limit = 100): LearningEvidence[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        `SELECT evidence_json FROM learning_evidence
         WHERE learner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(learnerId, safeLimit) as { evidence_json: string }[];
    return rows.map((row) =>
      LearningEvidenceSchema.parse(JSON.parse(row.evidence_json) as unknown),
    );
  }

  appendTeachingFeedback(unparsedFeedback: TeachingFeedback): void {
    const feedback = TeachingFeedbackSchema.parse(unparsedFeedback);
    this.#database
      .prepare(
        `INSERT INTO teaching_feedback (
          id, learner_id, session_id, feedback_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        feedback.id,
        feedback.learnerId,
        feedback.sessionId,
        JSON.stringify(feedback),
        feedback.createdAt,
      );
  }

  listTeachingFeedback(learnerId: string, limit = 100): TeachingFeedback[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        `SELECT feedback_json FROM teaching_feedback
         WHERE learner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(learnerId, safeLimit) as { feedback_json: string }[];
    return rows.map((row) =>
      TeachingFeedbackSchema.parse(JSON.parse(row.feedback_json) as unknown),
    );
  }

  appendPedagogyDecision(unparsedDecision: PedagogyDecision): void {
    const decision = PedagogyDecisionSchema.parse(unparsedDecision);
    this.#database
      .prepare(
        `INSERT INTO pedagogy_decisions (
          session_id, decision_json, created_at
        ) VALUES (?, ?, ?)`,
      )
      .run(decision.sessionId, JSON.stringify(decision), decision.createdAt);
  }

  listPedagogyDecisions(sessionId: string): PedagogyDecision[] {
    const rows = this.#database
      .prepare(
        `SELECT decision_json FROM pedagogy_decisions
         WHERE session_id = ? ORDER BY id`,
      )
      .all(sessionId) as { decision_json: string }[];
    return rows.map((row) =>
      PedagogyDecisionSchema.parse(JSON.parse(row.decision_json) as unknown),
    );
  }

  saveEducationProfile(unparsedProfile: LearnerEducationProfile): void {
    const profile = LearnerEducationProfileSchema.parse(unparsedProfile);
    this.#database
      .prepare(
        `INSERT INTO education_profiles (learner_id, profile_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(learner_id) DO UPDATE SET
           profile_json = excluded.profile_json,
           updated_at = excluded.updated_at`,
      )
      .run(profile.learnerId, JSON.stringify(profile), profile.updatedAt);
  }

  findEducationProfile(learnerId: string): LearnerEducationProfile | undefined {
    const row = this.#database
      .prepare("SELECT profile_json FROM education_profiles WHERE learner_id = ?")
      .get(learnerId) as { profile_json: string } | undefined;
    return row
      ? LearnerEducationProfileSchema.parse(
          JSON.parse(row.profile_json) as unknown,
        )
      : undefined;
  }

  saveCuriosityTrail(unparsedTrail: CuriosityTrail): void {
    const trail = CuriosityTrailSchema.parse(unparsedTrail);
    this.#database
      .prepare(
        `INSERT INTO curiosity_trails (id, learner_id, trail_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           trail_json = excluded.trail_json,
           updated_at = excluded.updated_at`,
      )
      .run(trail.id, trail.learnerId, JSON.stringify(trail), trail.updatedAt);
  }

  listCuriosityTrails(learnerId: string): CuriosityTrail[] {
    const rows = this.#database
      .prepare(
        `SELECT trail_json FROM curiosity_trails
         WHERE learner_id = ? ORDER BY updated_at DESC`,
      )
      .all(learnerId) as { trail_json: string }[];
    return rows.map((row) =>
      CuriosityTrailSchema.parse(JSON.parse(row.trail_json) as unknown),
    );
  }

  saveLearnerAccessCode(unparsedRecord: LearnerAccessCode): void {
    const record = LearnerAccessCodeSchema.parse(unparsedRecord);
    this.#database
      .prepare(
        `INSERT INTO learner_access_codes (
          learner_id, code_fingerprint, code_hash, salt, created_at, rotated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(learner_id) DO UPDATE SET
          code_fingerprint = excluded.code_fingerprint,
          code_hash = excluded.code_hash,
          salt = excluded.salt,
          rotated_at = excluded.rotated_at`,
      )
      .run(
        record.learnerId,
        record.codeFingerprint,
        record.codeHash,
        record.salt,
        record.createdAt,
        record.rotatedAt,
      );
  }

  findLearnerAccessCode(learnerId: string): LearnerAccessCode | undefined {
    const row = this.#database
      .prepare("SELECT * FROM learner_access_codes WHERE learner_id = ?")
      .get(learnerId) as
      | {
          learner_id: string;
          code_fingerprint: string;
          code_hash: string;
          salt: string;
          created_at: string;
          rotated_at: string | null;
        }
      | undefined;
    return row
      ? LearnerAccessCodeSchema.parse({
          learnerId: row.learner_id,
          codeFingerprint: row.code_fingerprint,
          codeHash: row.code_hash,
          salt: row.salt,
          createdAt: row.created_at,
          rotatedAt: row.rotated_at,
        })
      : undefined;
  }

  findLearnerAccessCodeByFingerprint(
    codeFingerprint: string,
  ): LearnerAccessCode | undefined {
    const row = this.#database
      .prepare(
        "SELECT learner_id FROM learner_access_codes WHERE code_fingerprint = ?",
      )
      .get(codeFingerprint) as { learner_id: string } | undefined;
    return row ? this.findLearnerAccessCode(row.learner_id) : undefined;
  }

  appendLearnerCodeAttempt(unparsedAttempt: LearnerCodeAttempt): void {
    const attempt = LearnerCodeAttemptSchema.parse(unparsedAttempt);
    this.#database
      .prepare(
        `INSERT INTO learner_code_attempts (
          id, code_fingerprint, source_phone_hash, succeeded, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        attempt.id,
        attempt.codeFingerprint,
        attempt.sourcePhoneHash,
        attempt.succeeded ? 1 : 0,
        attempt.createdAt,
      );
  }

  countRecentLearnerCodeFailures(options: {
    sourcePhoneHash: string;
    codeFingerprint: string;
    since: string;
  }): number {
    const row = this.#database
      .prepare(
        `SELECT COUNT(*) AS count FROM learner_code_attempts
         WHERE succeeded = 0 AND created_at >= ?
           AND (source_phone_hash = ? OR code_fingerprint = ?)`,
      )
      .get(
        options.since,
        options.sourcePhoneHash,
        options.codeFingerprint,
      ) as { count: number };
    return row.count;
  }

  saveCallbackJob(unparsedJob: CallbackJob): void {
    const job = CallbackJobSchema.parse(unparsedJob);
    this.#database
      .prepare(
        `INSERT INTO callback_jobs (
          id, source_call_sid, caller_phone_hash, encrypted_caller_number,
          access_mode, status, attempts, claim_token, claim_expires_at,
          provider_call_sid, error_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          attempts = excluded.attempts,
          claim_token = excluded.claim_token,
          claim_expires_at = excluded.claim_expires_at,
          provider_call_sid = excluded.provider_call_sid,
          error_code = excluded.error_code,
          updated_at = excluded.updated_at`,
      )
      .run(
        job.id,
        job.sourceCallSid,
        job.callerPhoneHash,
        job.encryptedCallerNumber,
        job.accessMode,
        job.status,
        job.attempts,
        job.claimToken,
        job.claimExpiresAt,
        job.providerCallSid,
        job.errorCode,
        job.createdAt,
        job.updatedAt,
      );
  }

  #callbackJobFromRow(row: Record<string, unknown>): CallbackJob {
    return CallbackJobSchema.parse({
      id: row.id,
      sourceCallSid: row.source_call_sid,
      callerPhoneHash: row.caller_phone_hash,
      encryptedCallerNumber: row.encrypted_caller_number,
      accessMode: row.access_mode,
      status: row.status,
      attempts: row.attempts,
      claimToken: row.claim_token,
      claimExpiresAt: row.claim_expires_at,
      providerCallSid: row.provider_call_sid,
      errorCode: row.error_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  findCallbackJobBySourceCallSid(sourceCallSid: string): CallbackJob | undefined {
    const row = this.#database
      .prepare("SELECT * FROM callback_jobs WHERE source_call_sid = ?")
      .get(sourceCallSid) as Record<string, unknown> | undefined;
    return row ? this.#callbackJobFromRow(row) : undefined;
  }

  findRecentCallbackJob(options: {
    callerPhoneHash: string;
    since: string;
  }): CallbackJob | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM callback_jobs
         WHERE caller_phone_hash = ? AND created_at >= ?
           AND status IN ('pending', 'claimed', 'completed')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(options.callerPhoneHash, options.since) as
      | Record<string, unknown>
      | undefined;
    return row ? this.#callbackJobFromRow(row) : undefined;
  }

  countCallbackJobsSince(since: string, callerPhoneHash?: string): number {
    const row = callerPhoneHash
      ? (this.#database
          .prepare(
            "SELECT COUNT(*) AS count FROM callback_jobs WHERE created_at >= ? AND caller_phone_hash = ?",
          )
          .get(since, callerPhoneHash) as { count: number })
      : (this.#database
          .prepare(
            "SELECT COUNT(*) AS count FROM callback_jobs WHERE created_at >= ?",
          )
          .get(since) as { count: number });
    return row.count;
  }

  claimCallbackJob(options: {
    id: string;
    claimToken: string;
    claimExpiresAt: string;
    now: string;
  }): CallbackJob | undefined {
    const transaction = this.#database.transaction(() => {
      const existing = this.#database
        .prepare("SELECT * FROM callback_jobs WHERE id = ?")
        .get(options.id) as Record<string, unknown> | undefined;
      if (!existing) return undefined;
      const job = this.#callbackJobFromRow(existing);
      if (
        job.status !== "pending" &&
        !(job.status === "claimed" && job.claimExpiresAt! < options.now)
      ) {
        return undefined;
      }
      this.#database
        .prepare(
          `UPDATE callback_jobs SET status = 'claimed', claim_token = ?,
           claim_expires_at = ?, attempts = attempts + 1, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          options.claimToken,
          options.claimExpiresAt,
          options.now,
          options.id,
        );
      const claimed = this.#database
        .prepare("SELECT * FROM callback_jobs WHERE id = ?")
        .get(options.id) as Record<string, unknown>;
      return this.#callbackJobFromRow(claimed);
    });
    return transaction();
  }

  saveCarrierCallReceipt(unparsedReceipt: CarrierCallReceipt): void {
    const receipt = CarrierCallReceiptSchema.parse(unparsedReceipt);
    this.#database
      .prepare(
        `INSERT INTO carrier_call_receipts (
          id, provider_call_sid, receipt_json, status, price_amount, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider_call_sid = excluded.provider_call_sid,
          receipt_json = excluded.receipt_json,
          status = excluded.status,
          price_amount = excluded.price_amount,
          updated_at = excluded.updated_at`,
      )
      .run(
        receipt.id,
        receipt.providerCallSid,
        JSON.stringify(receipt),
        receipt.status,
        receipt.priceAmount,
        receipt.updatedAt,
      );
  }

  findCarrierCallReceipt(id: string): CarrierCallReceipt | undefined {
    const row = this.#database
      .prepare("SELECT receipt_json FROM carrier_call_receipts WHERE id = ?")
      .get(id) as { receipt_json: string } | undefined;
    return row
      ? CarrierCallReceiptSchema.parse(JSON.parse(row.receipt_json) as unknown)
      : undefined;
  }

  findCarrierCallReceiptByProviderSid(
    providerCallSid: string,
  ): CarrierCallReceipt | undefined {
    const row = this.#database
      .prepare(
        "SELECT receipt_json FROM carrier_call_receipts WHERE provider_call_sid = ?",
      )
      .get(providerCallSid) as { receipt_json: string } | undefined;
    return row
      ? CarrierCallReceiptSchema.parse(JSON.parse(row.receipt_json) as unknown)
      : undefined;
  }

  listCarrierCallReceipts(limit = 10_000): CarrierCallReceipt[] {
    const safeLimit = Math.max(1, Math.min(50_000, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        "SELECT receipt_json FROM carrier_call_receipts ORDER BY updated_at DESC LIMIT ?",
      )
      .all(safeLimit) as { receipt_json: string }[];
    return rows.map((row) =>
      CarrierCallReceiptSchema.parse(JSON.parse(row.receipt_json) as unknown),
    );
  }

  listUnpricedCarrierCallReceipts(limit = 20): CarrierCallReceipt[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        `SELECT receipt_json FROM carrier_call_receipts
         WHERE status IN ('completed', 'busy', 'failed', 'no_answer', 'canceled')
           AND price_amount IS NULL
         ORDER BY updated_at LIMIT ?`,
      )
      .all(safeLimit) as { receipt_json: string }[];
    return rows.map((row) =>
      CarrierCallReceiptSchema.parse(JSON.parse(row.receipt_json) as unknown),
    );
  }

  saveGuardianAuthorization(
    unparsedAuthorization: GuardianAuthorization,
  ): void {
    const authorization = GuardianAuthorizationSchema.parse(
      unparsedAuthorization,
    );
    this.#database
      .prepare(
        `INSERT INTO guardian_authorizations (
          learner_id, guardian_phone_hash, code_fingerprint, code_hash, salt,
          sms_allowed, proactive_calls_allowed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(learner_id) DO UPDATE SET
          guardian_phone_hash = excluded.guardian_phone_hash,
          code_fingerprint = excluded.code_fingerprint,
          code_hash = excluded.code_hash,
          salt = excluded.salt,
          sms_allowed = excluded.sms_allowed,
          proactive_calls_allowed = excluded.proactive_calls_allowed,
          updated_at = excluded.updated_at`,
      )
      .run(
        authorization.learnerId,
        authorization.guardianPhoneHash,
        authorization.codeFingerprint,
        authorization.codeHash,
        authorization.salt,
        authorization.smsAllowed ? 1 : 0,
        authorization.proactiveCallsAllowed ? 1 : 0,
        authorization.createdAt,
        authorization.updatedAt,
      );
  }

  findGuardianAuthorization(
    learnerId: string,
  ): GuardianAuthorization | undefined {
    const row = this.#database
      .prepare("SELECT * FROM guardian_authorizations WHERE learner_id = ?")
      .get(learnerId) as Record<string, unknown> | undefined;
    return row ? this.#guardianAuthorizationFromRow(row) : undefined;
  }

  findGuardianAuthorizationByFingerprint(
    codeFingerprint: string,
  ): GuardianAuthorization | undefined {
    const row = this.#database
      .prepare(
        "SELECT * FROM guardian_authorizations WHERE code_fingerprint = ?",
      )
      .get(codeFingerprint) as Record<string, unknown> | undefined;
    return row ? this.#guardianAuthorizationFromRow(row) : undefined;
  }

  #guardianAuthorizationFromRow(
    row: Record<string, unknown>,
  ): GuardianAuthorization {
    return GuardianAuthorizationSchema.parse({
      learnerId: row.learner_id,
      guardianPhoneHash: row.guardian_phone_hash,
      codeFingerprint: row.code_fingerprint,
      codeHash: row.code_hash,
      salt: row.salt,
      smsAllowed: row.sms_allowed === 1,
      proactiveCallsAllowed: row.proactive_calls_allowed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  saveStudyPlan(unparsedPlan: StudyPlan): void {
    const plan = StudyPlanSchema.parse(unparsedPlan);
    this.#database
      .prepare(
        `INSERT INTO study_plans (
          learner_id, plan_json, next_scheduled_call, status, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(learner_id) DO UPDATE SET
          plan_json = excluded.plan_json,
          next_scheduled_call = excluded.next_scheduled_call,
          status = excluded.status,
          updated_at = excluded.updated_at`,
      )
      .run(
        plan.learnerId,
        JSON.stringify(plan),
        plan.nextScheduledCall,
        plan.status,
        plan.updatedAt,
      );
  }

  findStudyPlan(learnerId: string): StudyPlan | undefined {
    const row = this.#database
      .prepare("SELECT plan_json FROM study_plans WHERE learner_id = ?")
      .get(learnerId) as { plan_json: string } | undefined;
    return row
      ? StudyPlanSchema.parse(JSON.parse(row.plan_json) as unknown)
      : undefined;
  }

  claimDueStudyPlans(options: {
    now: string;
    claimToken: string;
    claimExpiresAt: string;
    limit: number;
  }): StudyPlan[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(options.limit)));
    return this.#database.transaction(() => {
      const rows = this.#database
        .prepare(
          `SELECT plan_json FROM study_plans
           WHERE status = 'active' AND next_scheduled_call IS NOT NULL
             AND next_scheduled_call <= ?
           ORDER BY next_scheduled_call LIMIT ?`,
        )
        .all(options.now, safeLimit) as { plan_json: string }[];
      const claimed: StudyPlan[] = [];
      for (const row of rows) {
        const plan = StudyPlanSchema.parse(
          JSON.parse(row.plan_json) as unknown,
        );
        if (plan.claimExpiresAt && plan.claimExpiresAt >= options.now) continue;
        const next = StudyPlanSchema.parse({
          ...plan,
          claimToken: options.claimToken,
          claimExpiresAt: options.claimExpiresAt,
          updatedAt: options.now,
        });
        this.saveStudyPlan(next);
        claimed.push(next);
      }
      return claimed;
    })();
  }

  reserveSmsMessage(messageSid: string, createdAt: string): boolean {
    const result = this.#database
      .prepare(
        `INSERT OR IGNORE INTO inbound_sms_receipts (
          message_sid, learner_id, action, response_text, created_at
        ) VALUES (?, NULL, 'processing', 'Processing.', ?)`,
      )
      .run(messageSid, createdAt);
    return result.changes === 1;
  }

  completeSmsMessage(unparsedReceipt: SmsReceipt): void {
    const receipt = SmsReceiptSchema.parse(unparsedReceipt);
    this.#database
      .prepare(
        `UPDATE inbound_sms_receipts SET learner_id = ?, action = ?,
         response_text = ?, created_at = ? WHERE message_sid = ?`,
      )
      .run(
        receipt.learnerId,
        receipt.action,
        receipt.responseText,
        receipt.createdAt,
        receipt.messageSid,
      );
  }

  findSmsReceipt(messageSid: string): SmsReceipt | undefined {
    const row = this.#database
      .prepare("SELECT * FROM inbound_sms_receipts WHERE message_sid = ?")
      .get(messageSid) as Record<string, unknown> | undefined;
    return row
      ? SmsReceiptSchema.parse({
          messageSid: row.message_sid,
          learnerId: row.learner_id,
          action: row.action,
          responseText: row.response_text,
          createdAt: row.created_at,
        })
      : undefined;
  }

  hasRecentDeletionRequest(learnerId: string, since: string): boolean {
    const row = this.#database
      .prepare(
        `SELECT 1 FROM inbound_sms_receipts
         WHERE learner_id = ? AND action = 'delete_requested' AND created_at >= ?
         LIMIT 1`,
      )
      .get(learnerId, since);
    return Boolean(row);
  }

  saveHomeworkAssignment(unparsedAssignment: HomeworkAssignment): void {
    const assignment = HomeworkAssignmentSchema.parse(unparsedAssignment);
    this.#database
      .prepare(
        `INSERT INTO homework_assignments (
          id, code, learner_id, assignment_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          assignment_json = excluded.assignment_json,
          updated_at = excluded.updated_at`,
      )
      .run(
        assignment.id,
        assignment.code,
        assignment.learnerId,
        JSON.stringify(assignment),
        assignment.createdAt,
        assignment.updatedAt,
      );
  }

  findHomeworkAssignmentByCode(code: string): HomeworkAssignment | undefined {
    const row = this.#database
      .prepare("SELECT assignment_json FROM homework_assignments WHERE code = ?")
      .get(code) as { assignment_json: string } | undefined;
    return row
      ? HomeworkAssignmentSchema.parse(JSON.parse(row.assignment_json) as unknown)
      : undefined;
  }

  listHomeworkAssignments(learnerId: string): HomeworkAssignment[] {
    const rows = this.#database
      .prepare(
        "SELECT assignment_json FROM homework_assignments WHERE learner_id = ? ORDER BY created_at DESC",
      )
      .all(learnerId) as { assignment_json: string }[];
    return rows.map((row) =>
      HomeworkAssignmentSchema.parse(JSON.parse(row.assignment_json) as unknown),
    );
  }

  deleteLearnerData(learnerId: string): void {
    this.#database.transaction(() => {
      const lessonIds = this.#database
        .prepare("SELECT id FROM lesson_sessions WHERE learner_id = ?")
        .all(learnerId) as { id: string }[];
      for (const { id } of lessonIds) {
        this.#database.prepare("DELETE FROM model_usage WHERE session_id = ?").run(id);
        this.#database.prepare("DELETE FROM sandbox_turns WHERE session_id = ?").run(id);
        this.#database.prepare("DELETE FROM teaching_turns WHERE session_id = ?").run(id);
      }
      this.#database.prepare("DELETE FROM lesson_sessions WHERE learner_id = ?").run(learnerId);
      this.#database
        .prepare(
          "UPDATE inbound_sms_receipts SET learner_id = NULL, response_text = 'Profile deleted.' WHERE learner_id = ?",
        )
        .run(learnerId);
      this.#database.prepare("DELETE FROM learners WHERE id = ?").run(learnerId);
    })();
  }

  appendProductMetric(unparsedEvent: ProductMetricEvent): void {
    const event = ProductMetricEventSchema.parse(unparsedEvent);
    this.#database
      .prepare(
        `INSERT OR IGNORE INTO product_metric_events (
          id, name, learner_id, session_id, event_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.name,
        event.learnerId,
        event.sessionId,
        JSON.stringify(event),
        event.createdAt,
      );
  }

  listProductMetrics(limit = 10_000): ProductMetricEvent[] {
    const safeLimit = Math.max(1, Math.min(50_000, Math.trunc(limit)));
    const rows = this.#database
      .prepare(
        "SELECT event_json FROM product_metric_events ORDER BY created_at DESC, rowid DESC LIMIT ?",
      )
      .all(safeLimit) as { event_json: string }[];
    return rows.map((row) =>
      ProductMetricEventSchema.parse(JSON.parse(row.event_json) as unknown),
    );
  }

  close(): void {
    this.#database.close();
  }
}
