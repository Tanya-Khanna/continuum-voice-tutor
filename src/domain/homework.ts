import { z } from "zod";

export const HomeworkCodeSchema = z.string().regex(/^[A-Z0-9]{6}$/u);
const HomeworkKeySchema = z.enum(["1", "2", "3", "4"]);

export const HomeworkAssignmentSchema = z.object({
  id: z.string().min(1),
  code: HomeworkCodeSchema,
  learnerId: z.string().min(1),
  sessionId: z.string().min(1),
  curriculumPackId: z.string().min(1),
  concept: z.string().min(1),
  reviewedQuestionId: z.string().min(1),
  recipientPhoneHash: z.string().length(64),
  prompt: z.string().trim().min(1).max(100),
  choices: z
    .array(
      z.object({
        key: HomeworkKeySchema,
        label: z.string().trim().min(1).max(60),
      }),
    )
    .min(2)
    .max(4),
  correctKey: HomeworkKeySchema,
  status: z.enum(["pending", "correct", "incorrect"]),
  submittedKey: HomeworkKeySchema.nullable(),
  dueAt: z.string().datetime(),
  answeredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const HomeworkReplySchema = z.object({
  code: HomeworkCodeSchema,
  answer: HomeworkKeySchema,
});

export type HomeworkAssignment = z.infer<typeof HomeworkAssignmentSchema>;
export type HomeworkReply = z.infer<typeof HomeworkReplySchema>;

export function parseHomeworkReply(body: string): HomeworkReply | undefined {
  const match = /^HW\s+([A-Z0-9]{6})\s+([1-4])$/iu.exec(body.trim());
  return match
    ? HomeworkReplySchema.parse({
        code: match[1]!.toUpperCase(),
        answer: match[2],
      })
    : undefined;
}
