import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";
import { createLessonRuntime } from "../src/runtime/lesson-runtime.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("multi-subject lesson runtime", () => {
  it("loads an ordered environment catalog and routes the selected pack", () => {
    const directory = mkdtempSync(join(tmpdir(), "nomad-catalog-runtime-"));
    directories.push(directory);
    const sciencePath = join(directory, "science.json");
    const sciencePack = CurriculumPackSchema.parse({
      ...fractionsPack,
      id: "runtime-science-pack",
      deployment: { ...fractionsPack.deployment, subject: "Science" },
    });
    writeFileSync(sciencePath, JSON.stringify(sciencePack));

    const environment = loadEnvironment({
      TEACHING_ENGINE: "offline",
      NOMAD_DATABASE_PATH: ":memory:",
      NOMAD_PHONE_HASH_SECRET: "runtime-catalog-test-secret",
      NOMAD_CURRICULUM_PATHS: JSON.stringify([
        `builtin:${fractionsPack.id}`,
        sciencePath,
      ]),
    });
    const runtime = createLessonRuntime(environment);
    try {
      expect(runtime.lessonService.availableSubjects()).toEqual([
        "Math",
        "Science",
      ]);
      const learner = runtime.lessonService.identifyLearner({
        phoneNumber: "+919999900104",
        learnerName: "Runtime Learner",
      });
      const context = runtime.lessonService.beginOrResumeSubject(
        learner,
        "Science",
      );
      expect(context.session.curriculumPackId).toBe(sciencePack.id);
      expect(runtime.lessonService.subjectForContext(context)).toBe("Science");
    } finally {
      runtime.close();
    }
  });
});
