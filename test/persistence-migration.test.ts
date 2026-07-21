import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteLearningRepository } from "../src/persistence/sqlite-learning-repository.js";

describe("SQLite learning migrations", () => {
  it("adds a nullable anchor object to an existing lesson database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nomad-legacy-db-"));
    const path = join(directory, "legacy.db");
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE learners (
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
      CREATE TABLE lesson_sessions (
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
      INSERT INTO learners VALUES (
        'learner_legacy', '${"a".repeat(64)}', 'Legacy', 'legacy', 'en',
        'comparing_unit_fractions', 'needs_support',
        '2026-07-17T00:00:00.000Z', '2026-07-17T00:00:00.000Z'
      );
      INSERT INTO lesson_sessions VALUES (
        'lesson_legacy', 'learner_legacy', 'comparing_unit_fractions', 'paused',
        1, 'Why?', 'Historical diagnosis', 'ask_reasoning', 'needs_support',
        'No evidence', '2026-07-17T00:00:00.000Z', '2026-07-17T00:00:00.000Z'
      );
    `);
    legacy.close();

    const repository = new SqliteLearningRepository(path);
    expect(repository.findLesson("lesson_legacy")).toMatchObject({
      id: "lesson_legacy",
      curriculumPackId: "legacy",
      placementLevel: "unplaced",
      placementScore: 0,
      placementTotal: 0,
      placementEvidence: [],
      anchorObject: null,
      accessMode: "unknown",
    });
    repository.close();
  });
});
