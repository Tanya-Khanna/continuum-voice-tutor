import { loadCurriculumPack } from "../config/curriculum.js";
import {
  requireOpenAIKey,
  type Environment,
} from "../config/env.js";
import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";
import { LessonService } from "../lesson/lesson-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

export function createLessonRuntime(environment: Environment): {
  lessonService: LessonService;
  close: () => void;
} {
  const curriculumPack = loadCurriculumPack(environment.NOMAD_CURRICULUM_PATH);
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );
  const engine: TeachingEngine =
    environment.TEACHING_ENGINE === "openai"
      ? new OpenAITeachingEngine({
          apiKey: requireOpenAIKey(environment),
          model: environment.OPENAI_TEXT_MODEL,
          curriculumPack,
        })
      : new OfflineTeachingEngine(curriculumPack);

  return {
    lessonService: new LessonService({
      repository,
      engine,
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
      curriculumPack,
    }),
    close: () => repository.close(),
  };
}
