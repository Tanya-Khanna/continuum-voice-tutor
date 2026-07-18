import { z } from "zod";

export const GuardianAuthorizationSchema = z.object({
  learnerId: z.string().min(1),
  guardianPhoneHash: z.string().length(64),
  codeFingerprint: z.string().length(64),
  codeHash: z.string().length(64),
  salt: z.string().min(16),
  smsAllowed: z.boolean(),
  proactiveCallsAllowed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GuardianAuthorization = z.infer<
  typeof GuardianAuthorizationSchema
>;
