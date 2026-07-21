import { loadEnvironment } from "../config/env.js";
import { PortableIdentityService } from "../domain/portable-identity.js";
import { GuardianAccessService } from "../guardian/guardian-access-service.js";
import { SqliteLearningRepository } from "../persistence/sqlite-learning-repository.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const learnerCode = argument("learner-code");
const guardianPhone = argument("guardian-phone");
if (!learnerCode || !guardianPhone) {
  throw new Error(
    "Usage: npm run guardian:enroll -- --learner-code 123456 --guardian-phone +919999999999",
  );
}

const environment = loadEnvironment();
const repository = new SqliteLearningRepository(environment.NOMAD_DATABASE_PATH);
try {
  const portableIdentity = new PortableIdentityService({
    repository,
    secret: environment.NOMAD_LEARNER_CODE_SECRET,
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
  });
  const verified = portableIdentity.verify({
    code: learnerCode,
    sourcePhoneNumber: guardianPhone,
    attemptsThisCall: 0,
  });
  if (verified.status !== "matched") {
    throw new Error("The learner code could not be verified.");
  }
  const guardianCode = new GuardianAccessService({
    repository,
    secret: environment.NOMAD_GUARDIAN_CODE_SECRET,
    phoneHashSecret: environment.NOMAD_PHONE_HASH_SECRET,
  }).issue({
    learnerId: verified.learner.id,
    guardianPhoneNumber: guardianPhone,
    smsAllowed: true,
    proactiveCallsAllowed: false,
  });
  console.log(`SMS authorized for ${verified.learner.name}.`);
  console.log(`Private guardian code: ${guardianCode}`);
  console.log(
    "The learner must still confirm each one-time reminder. STOP plus this code cancels proactive SMS.",
  );
} finally {
  repository.close();
}
