import { z } from "zod";

export const MisconceptionSchema = z.object({
  id: z.string().min(1),
  signals: z.array(z.string().min(1)).min(1),
  diagnosis: z.string().min(1),
  strategy: z.string().min(1),
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
});

export const CurriculumPackSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  deployment: z.object({
    country: z.string().min(1),
    grade: z.number().int().positive(),
    languages: z.array(z.string().min(1)).min(1),
    syllabus: z.string().min(1),
  }),
  concepts: z.array(CurriculumConceptSchema).min(1),
});

export type CurriculumConcept = z.infer<typeof CurriculumConceptSchema>;
export type CurriculumPack = z.infer<typeof CurriculumPackSchema>;
