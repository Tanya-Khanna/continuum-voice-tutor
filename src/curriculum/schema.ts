import { z } from "zod";
import {
  ResolvedLanguageModeSchema,
  TeachingStrategySchema,
} from "../domain/teaching.js";

export const LanguageHintSchema = z.object({
  languageMode: ResolvedLanguageModeSchema,
  signals: z.array(z.string().min(1)).default([]),
  patterns: z.array(z.string().min(1)).default([]),
});

export const MisconceptionSchema = z.object({
  id: z.string().min(1),
  signals: z.array(z.string().min(1)).min(1),
  diagnosis: z.string().min(1),
  strategy: TeachingStrategySchema,
  masteryEvidence: z.string().min(1),
  responseLead: z.string().min(1),
  nextQuestion: z.string().min(1),
});

export const EvidenceRuleSchema = z.object({
  answerSignals: z.array(z.string().min(1)).min(1),
  reasoningSignals: z.array(z.string().min(1)).min(1),
  diagnosis: z.string().min(1),
  masteryEvidence: z.string().min(1),
  responseLead: z.string().min(1),
  nextQuestion: z.string().min(1),
});

export const CurriculumConceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  grade: z.number().int().positive(),
  learningObjective: z.string().min(1),
  verifiedFacts: z.array(z.string().min(1)).min(1),
  misconceptions: z.array(MisconceptionSchema),
  concreteAnalogies: z.array(z.string().min(1)).min(1),
  retrievalQuestions: z.array(z.string().min(1)).min(1),
  teachingScaffold: z.object({
    entryQuestion: z.string().min(1),
    silenceQuestion: z.string().min(1),
    silenceResponseLead: z.string().min(1),
    answerRequestSignals: z.array(z.string().min(1)).min(1),
    answerRequestDiagnosis: z.string().min(1),
    answerRequestEvidence: z.string().min(1),
    answerRequestResponseLead: z.string().min(1),
    answerRequestQuestion: z.string().min(1),
    evidenceRules: z.array(EvidenceRuleSchema).min(1),
    fallbackDiagnosis: z.string().min(1),
    fallbackEvidence: z.string().min(1),
    fallbackResponseLead: z.string().min(1),
    fallbackQuestion: z.string().min(1),
  }),
});

export const CurriculumPackSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  provenance: z.object({
    method: z.enum(["hand_verified", "compiled"]),
    sourceMaterials: z.array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
      }),
    ),
    generatedByModel: z.string().min(1).optional(),
    verifiedByModel: z.string().min(1).optional(),
  }),
  deployment: z.object({
    country: z.string().min(1),
    countryCode: z.string().regex(/^[A-Z]{2}$/u),
    grade: z.number().int().positive(),
    defaultLanguage: ResolvedLanguageModeSchema,
    languagePolicy: z.literal("model_detect_any"),
    testedLanguageModes: z.array(ResolvedLanguageModeSchema),
    offlineLanguageHints: z.array(LanguageHintSchema).default([]),
    syllabus: z.string().min(1),
  }),
  placementDiagnostic: z.object({
    questions: z
      .array(
        z.object({
          id: z.string().min(1),
          prompt: z.string().min(1),
          answerSignals: z.array(z.string().min(1)).min(1),
          reasoningSignals: z.array(z.string().min(1)).default([]),
        }),
      )
      .min(1),
    developingMinimum: z.number().int().nonnegative(),
    gradeReadyMinimum: z.number().int().positive(),
    recommendations: z.object({
      foundational: z.string().min(1),
      developing: z.string().min(1),
      grade_ready: z.string().min(1),
    }),
  }),
  lessonPolicy: z.object({
    targetTurns: z.number().int().min(3).max(20),
    recentDropRecoveryMinutes: z.number().int().positive().max(1_440),
    recentResumeLead: z.string().min(1),
    returnRetrievalLead: z.string().min(1),
    recapResponseLead: z.string().min(1),
    callAgainInvitation: z.string().min(1),
  }),
  safetyPolicy: z.object({
    unsafeSignals: z.array(z.string().min(1)).min(1),
    promptInjectionSignals: z.array(z.string().min(1)).min(1),
    offTopicSignals: z.array(z.string().min(1)).min(1),
    unsafeDiagnosis: z.string().min(1),
    unsafeResponseLead: z.string().min(1),
    promptInjectionDiagnosis: z.string().min(1),
    promptInjectionResponseLead: z.string().min(1),
    offTopicDiagnosis: z.string().min(1),
    offTopicResponseLead: z.string().min(1),
    gracefulEndResponse: z.string().min(1),
    maxConsecutiveRedirects: z.number().int().min(2).max(10),
  }),
  concepts: z.array(CurriculumConceptSchema).min(1),
});

export type CurriculumConcept = z.infer<typeof CurriculumConceptSchema>;
export type CurriculumPack = z.infer<typeof CurriculumPackSchema>;
export const CurriculumPackDraftSchema = CurriculumPackSchema.omit({
  provenance: true,
});
