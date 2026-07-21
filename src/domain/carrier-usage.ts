import { z } from "zod";

export const CarrierCallKindSchema = z.enum(["missed_call", "scheduled"]);

export const CarrierCallStatusSchema = z.enum([
  "creating",
  "queued",
  "initiated",
  "ringing",
  "answered",
  "completed",
  "busy",
  "failed",
  "no_answer",
  "canceled",
]);

export const CarrierCallReceiptSchema = z.object({
  id: z.string().min(1),
  providerCallSid: z
    .string()
    .regex(/^CA[0-9a-fA-F]{32}$/u)
    .nullable(),
  kind: CarrierCallKindSchema,
  learnerId: z.string().min(1).nullable(),
  callbackJobId: z.string().min(1).nullable(),
  requestedDurationMinutes: z.union([z.literal(3), z.literal(5), z.literal(10)]).nullable(),
  status: CarrierCallStatusSchema,
  sequenceNumber: z.number().int().min(-1),
  durationSeconds: z.number().int().nonnegative().nullable(),
  priceAmount: z.number().nonnegative().nullable(),
  priceCurrency: z.string().regex(/^[A-Z]{3}$/u).nullable(),
  priceFetchAttempts: z.number().int().nonnegative(),
  missedNoticeSent: z.boolean(),
  synthetic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const TwilioCallStatusWebhookSchema = z.object({
  CallSid: z.string().regex(/^CA[0-9a-fA-F]{32}$/u),
  CallStatus: z.enum([
    "queued",
    "initiated",
    "ringing",
    "in-progress",
    "completed",
    "busy",
    "failed",
    "no-answer",
    "canceled",
  ]),
  To: z.string().regex(/^\+[1-9]\d{7,14}$/u).optional(),
  SequenceNumber: z.coerce.number().int().nonnegative().default(0),
  CallDuration: z.coerce.number().int().nonnegative().optional(),
  SipResponseCode: z.coerce.number().int().positive().optional(),
});

export const TwilioCallResourceSchema = z
  .object({
    sid: z.string().regex(/^CA[0-9a-fA-F]{32}$/u),
    status: z.enum([
      "queued",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "failed",
      "no-answer",
      "canceled",
    ]),
    duration: z.string().regex(/^\d+$/u).nullable().optional(),
    price: z.string().regex(/^-?\d+(?:\.\d+)?$/u).nullable().optional(),
    price_unit: z.string().regex(/^[A-Z]{3}$/u).nullable().optional(),
  })
  .passthrough();

export const TwilioMessageStatusWebhookSchema = z.object({
  MessageSid: z.string().regex(/^(?:SM|MM)[0-9a-fA-F]{32}$/u),
  MessageStatus: z.enum([
    "accepted",
    "scheduled",
    "queued",
    "sending",
    "sent",
    "delivered",
    "undelivered",
    "failed",
    "canceled",
  ]),
  // Twilio may report zero while a message is still queued, before the final
  // segment count is known.
  NumSegments: z.coerce.number().int().nonnegative().optional(),
  ErrorCode: z.coerce.number().int().nonnegative().optional(),
});

export type CarrierCallReceipt = z.infer<typeof CarrierCallReceiptSchema>;
export type CarrierCallStatus = z.infer<typeof CarrierCallStatusSchema>;

export function carrierStatusFromTwilio(
  status: z.infer<typeof TwilioCallStatusWebhookSchema>["CallStatus"] | z.infer<typeof TwilioCallResourceSchema>["status"],
): CarrierCallStatus {
  if (status === "in-progress") return "answered";
  if (status === "no-answer") return "no_answer";
  return CarrierCallStatusSchema.parse(status);
}

export function terminalCarrierCallStatus(status: CarrierCallStatus): boolean {
  return ["completed", "busy", "failed", "no_answer", "canceled"].includes(status);
}
