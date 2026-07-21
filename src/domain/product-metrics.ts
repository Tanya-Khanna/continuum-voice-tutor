import { z } from "zod";

export const ProductMetricNameSchema = z.enum([
  "lesson_completed",
  "missed_call_queued",
  "callback_placed",
  "keypad_fallback_completed",
  "drop_paused",
  "drop_recovered",
  "cross_phone_resumed",
  "sms_command_processed",
  "homework_completed",
  "scheduled_call_dialed",
  "scheduled_call_failed",
  "carrier_call_answered",
  "carrier_call_completed",
  "carrier_call_no_answer",
  "carrier_call_failed",
  "carrier_call_duration_seconds",
  "carrier_call_cost_usd",
  "sms_segments_sent",
  "sms_delivered",
  "sms_failed",
]);

export const ProductMetricEventSchema = z.object({
  id: z.string().min(1),
  name: ProductMetricNameSchema,
  learnerId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  channel: z.enum(["phone", "dtmf", "sms", "system"]),
  accessMode: z.enum(["missed_call", "sponsored", "direct_dial", "scheduled", "unknown"]),
  numericValue: z.number().finite().nullable(),
  synthetic: z.boolean(),
  createdAt: z.string().datetime(),
});

export type ProductMetricEvent = z.infer<typeof ProductMetricEventSchema>;
