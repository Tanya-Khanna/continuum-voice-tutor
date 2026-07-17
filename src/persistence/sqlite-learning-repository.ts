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

interface LearnerRow {
  id: string;
  phone_hash: string;
  name: string;
  preferred_language: string;
  current_concept: string;
  last_mastery: string;
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
        created_at TEXT NOT NULL,
        UNIQUE(session_id, sequence)
      );
    `);
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
          current_concept, last_mastery, created_at, updated_at
        ) VALUES (
          @id, @phoneHash, @name, @normalizedName, @preferredLanguage,
          @currentConcept, @lastMastery, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          normalized_name = excluded.normalized_name,
          preferred_language = excluded.preferred_language,
          current_concept = excluded.current_concept,
          last_mastery = excluded.last_mastery,
          updated_at = excluded.updated_at`,
      )
      .run({
        ...learner,
        normalizedName: normalizeLearnerName(learner.name),
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
          id, session_id, sequence, turn_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.sessionId,
        entry.sequence,
        JSON.stringify(entry.turn),
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
        createdAt: row.created_at,
      }),
    );
  }

  close(): void {
    this.#database.close();
  }
}
