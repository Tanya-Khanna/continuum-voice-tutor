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
  concept: string;
  status: string;
  turn_count: number;
  last_prompt: string;
  last_diagnosis: string;
  last_strategy: string;
  mastery_status: string;
  mastery_evidence: string;
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
    concept: row.concept,
    status: row.status,
    turnCount: row.turn_count,
    lastPrompt: row.last_prompt,
    lastDiagnosis: row.last_diagnosis,
    lastStrategy: row.last_strategy,
    masteryStatus: row.mastery_status,
    masteryEvidence: row.mastery_evidence,
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
        concept TEXT NOT NULL,
        status TEXT NOT NULL,
        turn_count INTEGER NOT NULL,
        last_prompt TEXT NOT NULL,
        last_diagnosis TEXT NOT NULL,
        last_strategy TEXT NOT NULL,
        mastery_status TEXT NOT NULL,
        mastery_evidence TEXT NOT NULL,
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
    `);
    const turnColumns = this.#database.pragma(
      "table_info(teaching_turns)",
    ) as { name: string }[];
    if (!turnColumns.some((column) => column.name === "model_route")) {
      this.#database.exec(
        "ALTER TABLE teaching_turns ADD COLUMN model_route TEXT NOT NULL DEFAULT 'unknown'",
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

  findResumableLesson(learnerId: string): LessonSession | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM lesson_sessions
         WHERE learner_id = ? AND status IN ('active', 'paused')
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(learnerId) as LessonRow | undefined;
    return row ? lessonFromRow(row) : undefined;
  }

  findLatestLesson(learnerId: string): LessonSession | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM lesson_sessions
         WHERE learner_id = ?
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(learnerId) as LessonRow | undefined;
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
          id, learner_id, concept, status, turn_count, last_prompt,
          last_diagnosis, last_strategy, mastery_status, mastery_evidence,
          created_at, updated_at
        ) VALUES (
          @id, @learnerId, @concept, @status, @turnCount, @lastPrompt,
          @lastDiagnosis, @lastStrategy, @masteryStatus, @masteryEvidence,
          @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          turn_count = excluded.turn_count,
          last_prompt = excluded.last_prompt,
          last_diagnosis = excluded.last_diagnosis,
          last_strategy = excluded.last_strategy,
          mastery_status = excluded.mastery_status,
          mastery_evidence = excluded.mastery_evidence,
          updated_at = excluded.updated_at`,
      )
      .run(lesson);
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

  close(): void {
    this.#database.close();
  }
}
