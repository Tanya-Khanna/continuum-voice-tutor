import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  CurriculumCompileReceiptSchema,
  CurriculumReleaseTargetSchema,
  artifactSha256,
} from "../src/compiler/release-workflow.js";
import { CurriculumSourceBriefSchema } from "../src/compiler/schema.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";

const projectRoot = resolve(import.meta.dirname, "..");
const targetPath = resolve(
  projectRoot,
  process.argv[2] ?? "curriculum/releases/india-grade6.json",
);
const outputPath = resolve(
  projectRoot,
  process.argv[3] ?? "docs/CURRICULUM_CANDIDATE_REVIEW.md",
);
const targetDirectory = dirname(targetPath);
const target = CurriculumReleaseTargetSchema.parse(
  JSON.parse(readFileSync(targetPath, "utf8")) as unknown,
);

function lines(values: readonly string[]): string {
  return values.map((value) => `- ${value}`).join("\n");
}

function numbered(values: readonly string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

const sections: string[] = [];
for (const entry of target.entries) {
  if (entry.kind !== "compiled") continue;
  const sourcePath = resolve(targetDirectory, entry.sourceBrief);
  const candidatePath = resolve(targetDirectory, entry.candidate);
  const receiptPath = resolve(targetDirectory, entry.compileReceipt);
  const brief = CurriculumSourceBriefSchema.parse(
    JSON.parse(readFileSync(sourcePath, "utf8")) as unknown,
  );
  const pack = CurriculumPackSchema.parse(
    JSON.parse(readFileSync(candidatePath, "utf8")) as unknown,
  );
  const receipt = CurriculumCompileReceiptSchema.parse(
    JSON.parse(readFileSync(receiptPath, "utf8")) as unknown,
  );
  if (receipt.sourceBriefSha256 !== artifactSha256(brief)) {
    throw new Error(`${entry.subject} source-brief digest does not match.`);
  }
  if (receipt.packSha256 !== artifactSha256(pack)) {
    throw new Error(`${entry.subject} candidate digest does not match.`);
  }
  if (!receipt.verification.approved) {
    throw new Error(`${entry.subject} independent verification is not approved.`);
  }

  const conceptSections = pack.concepts.map((concept) => {
    const vocabulary = concept.vocabularyBridges.map(
      (bridge) =>
        `${bridge.canonicalTerm} (${bridge.termLanguage}): ${bridge.spokenDefinition}\n  - Bridge: ${bridge.offlineBridgeLead}\n  - Accepted learner language: ${bridge.informalSignals.join("; ")}`,
    );
    const keypad = concept.keypadQuestions.map((question) => {
      const choices = question.choices
        .map(
          (choice) =>
            `${choice.id}: ${choice.label}${choice.correct ? " [CORRECT]" : ""}`,
        )
        .join("; ");
      return `${question.prompt}\n  - Choices: ${choices}\n  - SMS: ${question.featurePhoneSms}`;
    });
    const anchors = concept.anchorActivities.map(
      (activity) =>
        `${activity.objectName}: ${activity.responseLead} ${activity.nextQuestion}`,
    );
    const evidence = concept.teachingScaffold.evidenceRules.map(
      (rule) =>
        `${rule.diagnosis}\n  - Evidence: ${rule.masteryEvidence}\n  - Tutor: ${rule.responseLead} ${rule.nextQuestion}`,
    );
    return `### ${concept.title}

**Objective:** ${concept.learningObjective}

**Verified facts**

${lines(concept.verifiedFacts)}

**Vocabulary bridges**

${numbered(vocabulary)}

**Concrete analogies**

${lines(concept.concreteAnalogies)}

**Safe object anchors**

${numbered(anchors)}

**Retrieval questions**

${lines(concept.retrievalQuestions)}

**Keypad and feature-phone SMS checks**

${numbered(keypad)}

**Teaching entry and recovery**

- Entry: ${concept.teachingScaffold.entryQuestion}
- Silence: ${concept.teachingScaffold.silenceResponseLead} ${concept.teachingScaffold.silenceQuestion}
- Answer request: ${concept.teachingScaffold.answerRequestResponseLead} ${concept.teachingScaffold.answerRequestQuestion}
- Fallback: ${concept.teachingScaffold.fallbackResponseLead} ${concept.teachingScaffold.fallbackQuestion}

**Evidence paths**

${numbered(evidence)}`;
  });

  const diagnostic = brief.requiredConcepts.length > 0
    ? pack.placementDiagnostic.questions.map(
        (question) =>
          `${question.prompt}\n  - Accepted answer evidence: ${question.answerSignals.join("; ")}\n  - Reasoning evidence: ${question.reasoningSignals.join("; ")}`,
      )
    : [];
  sections.push(`## ${entry.subject}

- Candidate: \`${relative(projectRoot, candidatePath)}\`
- Pack: \`${pack.id}\` version \`${pack.version}\`
- Source review: ${brief.review.reviewedBy} at ${brief.review.reviewedAt}
- Independent verifier: approved; ${receipt.verification.issues.length} remaining warnings
- Digest check: source and candidate match the verification receipt
- Languages tested by this deployment pack: ${pack.deployment.testedLanguageModes.join(", ")}

**Placement diagnostic**

${numbered(diagnostic)}

**Lesson continuity copy**

- Resume after recent drop: ${pack.lessonPolicy.recentResumeLead}
- Return retrieval: ${pack.lessonPolicy.returnRetrievalLead}
- Recap: ${pack.lessonPolicy.recapResponseLead}
- Invitation: ${pack.lessonPolicy.callAgainInvitation}

${conceptSections.join("\n\n")}

**Safety and boundaries**

- Unsafe redirect: ${pack.safetyPolicy.unsafeResponseLead}
- Prompt-injection redirect: ${pack.safetyPolicy.promptInjectionResponseLead}
- Benign off-topic redirect: ${pack.safetyPolicy.offTopicResponseLead}
- Graceful end: ${pack.safetyPolicy.gracefulEndResponse}`);
}

const document = `# Continuum curriculum candidate review

Generated from the digest-bound candidate packs. This document is a human-review aid; generating it does not approve or freeze a pack.

For each subject, confirm:

- Facts and answer keys are correct and stay inside the reviewed source scope.
- Spoken lines sound natural, short, non-shaming, and ask one useful question.
- Analogies and objects are safe, familiar, optional, and not stereotyped.
- Keypad answers and SMS copy are clear on a basic phone.
- Teaching preserves learner agency and distinguishes guesses from evidence.
- Safety redirects are calm and do not leak another learner's information.

${sections.join("\n\n")}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, document, "utf8");
console.log(`Curriculum candidate review packet written to ${outputPath}.`);
