import { z } from "zod";

export const SmsReminderSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  kind: z.enum(["exam_review", "callback_nudge"]),
  topic: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(160),
  recipientPhoneHash: z.string().length(64),
  encryptedRecipient: z.string().min(1),
  dueAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.enum(["pending", "claimed", "sent", "cancelled", "failed"]),
  claimToken: z.string().min(1).nullable(),
  claimExpiresAt: z.string().datetime().nullable(),
  providerMessageSid: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
});

export type SmsReminder = z.infer<typeof SmsReminderSchema>;
