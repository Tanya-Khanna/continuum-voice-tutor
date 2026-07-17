import {
  curriculumCatalogOptions,
  loadCurriculumCatalog,
} from "../config/curriculum.js";
import {
  requireOpenAIKey,
  type Environment,
} from "../config/env.js";
import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { OpenAITeachingEngine } from "../engine/openai-teaching-engine.js";
import type { TeachingEngine } from "../engine/teaching-engine.js";
import { CatalogLessonService } from "../lesson/catalog-lesson-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

export function createLessonRuntime(environment: Environment): {
  lessonService: CatalogLessonService;
  close: () => void;
} {
  const catalog = loadCurriculumCatalog(curriculumCatalogOptions(environment));
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );

  return {
    lessonService: new CatalogLessonService({
      repository,
      catalog,
      engineFactory: (packId): TeachingEngine => {
        const curriculumPack = catalog.requireByPackId(packId).pack;
        return environment.TEACHING_ENGINE === "openai"
          ? new OpenAITeachingEngine({
              apiKey: requireOpenAIKey(environment),
              model: environment.OPENAI_TEXT_MODEL,
              curriculumPack,
            })
          : new OfflineTeachingEngine(curriculumPack);
      },
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    }),
    close: () => repository.close(),
  };
}
