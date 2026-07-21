import { z } from "zod";
import {
  AnchorObjectSchema,
  MasteryStatusSchema,
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
  PersistedTeachingTurnSchema,
} from "./teaching.js";
import type { StoredModelUsage } from "./usage.js";
import type { StoredSandboxTurn } from "./sandbox.js";
import type {
  CuriosityTrail,
  LearnerEducationProfile,
  LearningEvidence,
  PedagogyDecision,
  TeachingFeedback,
} from "./classroom.js";
import { LessonDurationMinutesSchema } from "./classroom.js";
import type {
  LearnerAccessCode,
  LearnerCodeAttempt,
} from "./portable-identity.js";
import type { CallbackJob } from "./callback.js";
import type { GuardianAuthorization } from "./guardian.js";
import type { StudyPlan } from "./study-plan.js";
import type { SmsReceipt } from "./sms-control.js";
import {
  AccessModeSchema,
  type ProductMetricEvent,
} from "./product-metrics.js";
import type { HomeworkAssignment } from "./homework.js";
import type { CarrierCallReceipt } from "./carrier-usage.js";

export const LearnerProfileSchema = z.object({
  id: z.string().min(1),
  phoneHash: z.string().length(64),
  name: z.string().min(1).max(80),
  preferredLanguage: ResolvedLanguageModeSchema,
  currentConcept: z.string().min(1),
  lastMastery: MasteryStatusSchema,
  placementLevel: z
    .enum(["unplaced", "foundational", "developing", "grade_ready"])
    .default("unplaced"),
  placementScore: z.number().int().nonnegative().default(0),
  placementTotal: z.number().int().nonnegative().default(0),
  placementEvidence: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const LessonStatusSchema = z.enum(["active", "paused", "completed"]);

export const LessonSessionSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  curriculumPackId: z.string().min(1).default("legacy"),
  concept: z.string().min(1),
  status: LessonStatusSchema,
  turnCount: z.number().int().nonnegative(),
  lastPrompt: z.string().min(1),
  lastDiagnosis: z.string(),
  lastStrategy: TeachingStrategySchema,
  masteryStatus: MasteryStatusSchema,
  masteryEvidence: z.string(),
  placementLevel: z
    .enum(["unplaced", "foundational", "developing", "grade_ready"])
    .default("unplaced"),
  placementScore: z.number().int().nonnegative().default(0),
  placementTotal: z.number().int().nonnegative().default(0),
  placementEvidence: z.array(z.string()).default([]),
  anchorObject: AnchorObjectSchema.nullable().default(null),
  durationMinutes: LessonDurationMinutesSchema.default(5),
  accessMode: AccessModeSchema.default("unknown"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StoredTeachingTurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sequence: z.number().int().positive(),
  turn: PersistedTeachingTurnSchema,
  modelRoute: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;
export type LessonSession = z.infer<typeof LessonSessionSchema>;
export type StoredTeachingTurn = z.infer<typeof StoredTeachingTurnSchema>;

export interface LearningRepository {
  findLearner(id: string): LearnerProfile | undefined;
  listLearnersForPhone(phoneHash: string): LearnerProfile[];
  saveLearner(profile: LearnerProfile): void;
  findResumableLesson(
    learnerId: string,
    curriculumPackId?: string,
    includeLegacy?: boolean,
  ): LessonSession | undefined;
  findLatestLesson(
    learnerId: string,
    curriculumPackId?: string,
    includeLegacy?: boolean,
  ): LessonSession | undefined;
  findLesson(id: string): LessonSession | undefined;
  listRecentLessons(limit: number): LessonSession[];
  saveLesson(session: LessonSession): void;
  appendTurn(storedTurn: StoredTeachingTurn): void;
  listTurns(sessionId: string): StoredTeachingTurn[];
  appendSandboxTurn(storedTurn: StoredSandboxTurn): void;
  listSandboxTurns(sessionId: string): StoredSandboxTurn[];
  appendUsage(usage: StoredModelUsage): void;
  listUsage(sessionId: string): StoredModelUsage[];
  listAllUsage(limit?: number): StoredModelUsage[];
  appendLearningEvidence(evidence: LearningEvidence): void;
  listLearningEvidence(learnerId: string, limit?: number): LearningEvidence[];
  appendTeachingFeedback(feedback: TeachingFeedback): void;
  listTeachingFeedback(learnerId: string, limit?: number): TeachingFeedback[];
  appendPedagogyDecision(decision: PedagogyDecision): void;
  listPedagogyDecisions(sessionId: string): PedagogyDecision[];
  saveEducationProfile(profile: LearnerEducationProfile): void;
  findEducationProfile(learnerId: string): LearnerEducationProfile | undefined;
  saveCuriosityTrail(trail: CuriosityTrail): void;
  listCuriosityTrails(learnerId: string): CuriosityTrail[];
  saveLearnerAccessCode(record: LearnerAccessCode): void;
  findLearnerAccessCode(learnerId: string): LearnerAccessCode | undefined;
  findLearnerAccessCodeByFingerprint(
    codeFingerprint: string,
  ): LearnerAccessCode | undefined;
  appendLearnerCodeAttempt(attempt: LearnerCodeAttempt): void;
  countRecentLearnerCodeFailures(options: {
    sourcePhoneHash: string;
    codeFingerprint: string;
    since: string;
  }): number;
  saveCallbackJob(job: CallbackJob): void;
  findCallbackJobBySourceCallSid(sourceCallSid: string): CallbackJob | undefined;
  findRecentCallbackJob(options: {
    callerPhoneHash: string;
    since: string;
  }): CallbackJob | undefined;
  countCallbackJobsSince(since: string, callerPhoneHash?: string): number;
  claimCallbackJob(options: {
    id: string;
    claimToken: string;
    claimExpiresAt: string;
    now: string;
  }): CallbackJob | undefined;
  saveCarrierCallReceipt(receipt: CarrierCallReceipt): void;
  findCarrierCallReceipt(id: string): CarrierCallReceipt | undefined;
  findCarrierCallReceiptByProviderSid(
    providerCallSid: string,
  ): CarrierCallReceipt | undefined;
  listCarrierCallReceipts(limit?: number): CarrierCallReceipt[];
  listUnpricedCarrierCallReceipts(limit?: number): CarrierCallReceipt[];
  saveGuardianAuthorization(authorization: GuardianAuthorization): void;
  findGuardianAuthorization(learnerId: string): GuardianAuthorization | undefined;
  findGuardianAuthorizationByFingerprint(
    codeFingerprint: string,
  ): GuardianAuthorization | undefined;
  saveStudyPlan(plan: StudyPlan): void;
  findStudyPlan(learnerId: string): StudyPlan | undefined;
  claimDueStudyPlans(options: {
    now: string;
    claimToken: string;
    claimExpiresAt: string;
    limit: number;
  }): StudyPlan[];
  reserveSmsMessage(messageSid: string, createdAt: string): boolean;
  completeSmsMessage(receipt: SmsReceipt): void;
  findSmsReceipt(messageSid: string): SmsReceipt | undefined;
  hasRecentDeletionRequest(learnerId: string, since: string): boolean;
  deleteLearnerData(learnerId: string): void;
  appendProductMetric(event: ProductMetricEvent): void;
  listProductMetrics(limit?: number): ProductMetricEvent[];
  saveHomeworkAssignment(assignment: HomeworkAssignment): void;
  findHomeworkAssignmentByCode(code: string): HomeworkAssignment | undefined;
  listHomeworkAssignments(learnerId: string): HomeworkAssignment[];
  close(): void;
}
