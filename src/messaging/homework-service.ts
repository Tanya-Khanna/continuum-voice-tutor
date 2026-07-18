import { randomBytes, randomUUID } from "node:crypto";
import {
  HomeworkAssignmentSchema,
  type HomeworkAssignment,
  type HomeworkReply,
} from "../domain/homework.js";
import { hashPhoneNumber } from "../domain/identity.js";
import type { LearningRepository } from "../domain/learner.js";
import { LearningEvidenceSchema } from "../domain/classroom.js";
import { ProductMetricEventSchema } from "../domain/product-metrics.js";
import { smsSegmentInfo } from "../domain/sms-control.js";

export interface HomeworkDraft {
  curriculumPackId: string;
  concept: string;
  reviewedQuestionId: string;
  prompt: string;
  choices: { key: "1" | "2" | "3" | "4"; label: string }[];
  correctKey: "1" | "2" | "3" | "4";
}

function randomCode(): string {
  return randomBytes(4)
    .toString("base64url")
    .replace(/[^A-Z0-9]/giu, "")
    .toUpperCase()
    .padEnd(6, "X")
    .slice(0, 6);
}

export class HomeworkService {
  readonly #repository: LearningRepository;
  readonly #phoneHashSecret: string;
  readonly #clock: () => Date;
  readonly #makeId: () => string;
  readonly #makeCode: () => string;

  constructor(options: {
    repository: LearningRepository;
    phoneHashSecret: string;
    clock?: () => Date;
    makeId?: () => string;
    makeCode?: () => string;
  }) {
    this.#repository = options.repository;
    this.#phoneHashSecret = options.phoneHashSecret;
    this.#clock = options.clock ?? (() => new Date());
    this.#makeId = options.makeId ?? randomUUID;
    this.#makeCode = options.makeCode ?? randomCode;
  }

  assign(options: {
    learnerId: string;
    sessionId: string;
    recipientPhoneNumber: string;
    draft: HomeworkDraft;
  }): { assignment: HomeworkAssignment; smsText: string } {
    if (!this.#repository.findLearner(options.learnerId)) {
      throw new Error(`Unknown learner ${options.learnerId}.`);
    }
    let code: string | undefined;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = this.#makeCode();
      if (!this.#repository.findHomeworkAssignmentByCode(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Unable to allocate a homework code.");
    const nowDate = this.#clock();
    const now = nowDate.toISOString();
    const assignment = HomeworkAssignmentSchema.parse({
      id: this.#makeId(),
      code,
      learnerId: options.learnerId,
      sessionId: options.sessionId,
      curriculumPackId: options.draft.curriculumPackId,
      concept: options.draft.concept,
      reviewedQuestionId: options.draft.reviewedQuestionId,
      recipientPhoneHash: hashPhoneNumber(
        options.recipientPhoneNumber,
        this.#phoneHashSecret,
      ),
      prompt: options.draft.prompt,
      choices: options.draft.choices,
      correctKey: options.draft.correctKey,
      status: "pending",
      submittedKey: null,
      dueAt: new Date(nowDate.getTime() + 24 * 60 * 60_000).toISOString(),
      answeredAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const smsText = `HW ${code}: ${assignment.prompt}. Reply HW ${code} 1-4.`;
    if (smsSegmentInfo(smsText).segments !== 1) {
      throw new Error("Reviewed homework must fit in one SMS segment.");
    }
    this.#repository.saveHomeworkAssignment(assignment);
    return { assignment, smsText };
  }

  submit(options: {
    reply: HomeworkReply;
    sourcePhoneNumber: string;
  }): { assignment: HomeworkAssignment; responseText: string } {
    const assignment = this.#repository.findHomeworkAssignmentByCode(
      options.reply.code,
    );
    if (
      !assignment ||
      assignment.recipientPhoneHash !==
        hashPhoneNumber(options.sourcePhoneNumber, this.#phoneHashSecret)
    ) {
      throw new Error("Homework code not recognized for this phone.");
    }
    if (assignment.status !== "pending") {
      return {
        assignment,
        responseText: "That homework answer was already saved.",
      };
    }
    const correct = options.reply.answer === assignment.correctKey;
    const now = this.#clock().toISOString();
    const updated = HomeworkAssignmentSchema.parse({
      ...assignment,
      status: correct ? "correct" : "incorrect",
      submittedKey: options.reply.answer,
      answeredAt: now,
      updatedAt: now,
    });
    this.#repository.saveHomeworkAssignment(updated);
    this.#repository.appendLearningEvidence(
      LearningEvidenceSchema.parse({
        id: this.#makeId(),
        learnerId: updated.learnerId,
        sessionId: updated.sessionId,
        curriculumPackId: updated.curriculumPackId,
        concept: updated.concept,
        activityId: updated.id,
        kind: "homework",
        result: correct ? "correct" : "incorrect",
        independent: false,
        responseMode: "sms",
        reasoningEvidence: correct
          ? "The learner selected the reviewed homework answer. Reasoning was not observed."
          : "The learner selected a different reviewed homework answer.",
        strategy: "homework",
        hintCount: 0,
        createdAt: now,
      }),
    );
    this.#repository.appendProductMetric(
      ProductMetricEventSchema.parse({
        id: this.#makeId(),
        name: "homework_completed",
        learnerId: updated.learnerId,
        sessionId: updated.sessionId,
        channel: "sms",
        accessMode: "unknown",
        numericValue: correct ? 1 : 0,
        synthetic: false,
        createdAt: now,
      }),
    );
    return {
      assignment: updated,
      responseText: correct
        ? "Saved. That answer is correct. Continuum will check the idea again next lesson."
        : "Saved. We will work through that idea together on the next call.",
    };
  }
}
