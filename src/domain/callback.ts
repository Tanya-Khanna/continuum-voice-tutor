import { z } from "zod";

export const CallbackAccessModeSchema = z.enum([
  "missed_call",
  "toll_free",
  "sponsored",
  "direct_dial",
]);

export const CallbackJobStatusSchema = z.enum([
  "pending",
  "claimed",
  "completed",
  "failed",
  "blocked",
]);

export const CallbackJobSchema = z.object({
  id: z.string().min(1),
  sourceCallSid: z.string().min(1),
  callerPhoneHash: z.string().length(64),
  encryptedCallerNumber: z.string().min(1),
  accessMode: CallbackAccessModeSchema,
  status: CallbackJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  claimToken: z.string().min(1).nullable(),
  claimExpiresAt: z.string().datetime().nullable(),
  providerCallSid: z.string().min(1).nullable(),
  errorCode: z.string().max(120).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CallbackJob = z.infer<typeof CallbackJobSchema>;
