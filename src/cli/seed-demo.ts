import {
  curriculumCatalogOptions,
  loadCurriculumCatalog,
} from "../config/curriculum.js";
import { loadEnvironment } from "../config/env.js";
import { seedDemoState } from "../demo/seed-demo-state.js";
import { OfflineTeachingEngine } from "../engine/offline-teaching-engine.js";
import { CatalogLessonService } from "../lesson/catalog-lesson-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const catalog = loadCurriculumCatalog(curriculumCatalogOptions(environment));
  catalog.requireBySubject("Math");
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );
  const lessonService = new CatalogLessonService({
    repository,
    catalog,
    engineFactory: (packId) =>
      new OfflineTeachingEngine(catalog.requireByPackId(packId).pack),
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
  });

  try {
    const result = await seedDemoState({
      lessonService,
    });
    console.log(
      `Demo state ${result.created ? "created" : "already present"}: ${result.learnerName} is paused after ${result.turnCount} teaching turn${result.turnCount === 1 ? "" : "s"}.`,
    );
    console.log(`Subject: ${result.subject}`);
    console.log(`Pending prompt: ${result.pendingPrompt}`);
    console.log(
      `Resume with: npm run chat -- --name ${result.learnerName} --phone ${result.phoneNumber} --language en --subject ${result.subject}`,
    );
  } finally {
    repository.close();
  }
}

await main();
