import { requireOpenAIKey, type Environment } from "../config/env.js";
import { PortableIdentityService } from "../domain/portable-identity.js";
import { OpenAIOpenTopicEngine } from "../engine/openai-open-topic-engine.js";
import { OfflineOpenTopicEngine } from "../engine/offline-open-topic-engine.js";
import { GuardianAccessService } from "../guardian/guardian-access-service.js";
import { OpenTopicLessonService } from "../lesson/open-topic-lesson-service.js";
import { HomeworkService } from "../messaging/homework-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

export function createOpenTopicRuntime(environment: Environment): {
  repository: SqliteLearningRepository;
  lessonService: OpenTopicLessonService;
  portableIdentity: PortableIdentityService;
  guardianAccess: GuardianAccessService;
  homework: HomeworkService;
  close: () => void;
} {
  const repository = new SqliteLearningRepository(
    environment.NOMAD_DATABASE_PATH,
  );
  const engine =
    environment.TEACHING_ENGINE === "openai"
      ? new OpenAIOpenTopicEngine({
          apiKey: requireOpenAIKey(environment),
          model: environment.OPENAI_TEXT_MODEL,
        })
      : new OfflineOpenTopicEngine();

  return {
    repository,
    lessonService: new OpenTopicLessonService({
      repository,
      engine,
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    }),
    portableIdentity: new PortableIdentityService({
      repository,
      secret: environment.NOMAD_LEARNER_CODE_SECRET,
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    }),
    guardianAccess: new GuardianAccessService({
      repository,
      secret: environment.NOMAD_GUARDIAN_CODE_SECRET,
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    }),
    homework: new HomeworkService({
      repository,
      phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
    }),
    close: () => repository.close(),
  };
}
