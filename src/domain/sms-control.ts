import { z } from "zod";
import { LearnerCodeSchema } from "./portable-identity.js";
import { WeekdaySchema } from "./study-plan.js";

const WithCodeSchema = z.object({ code: LearnerCodeSchema });

export const SmsCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("help") }),
  WithCodeSchema.extend({ action: z.literal("start") }),
  WithCodeSchema.extend({ action: z.literal("stop") }),
  WithCodeSchema.extend({ action: z.literal("pause") }),
  WithCodeSchema.extend({ action: z.literal("resume") }),
  WithCodeSchema.extend({
    action: z.literal("time"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
  }),
  WithCodeSchema.extend({
    action: z.literal("days"),
    days: z.array(WeekdaySchema).min(1).max(7),
  }),
  WithCodeSchema.extend({ action: z.literal("progress") }),
  WithCodeSchema.extend({ action: z.literal("memory") }),
  WithCodeSchema.extend({
    action: z.literal("delete"),
    confirm: z.boolean(),
  }),
]);

export const InboundSmsSchema = z.object({
  MessageSid: z.string().regex(/^SM[0-9a-fA-F]{32}$/u),
  From: z.string().regex(/^\+[1-9]\d{7,14}$/u),
  To: z.string().regex(/^\+[1-9]\d{7,14}$/u),
  Body: z.string().trim().min(1).max(1_600),
});

export const SmsReceiptSchema = z.object({
  messageSid: z.string().min(1),
  learnerId: z.string().min(1).nullable(),
  action: z.string().min(1),
  responseText: z.string().min(1).max(1_600),
  createdAt: z.string().datetime(),
});

export type SmsCommand = z.infer<typeof SmsCommandSchema>;
export type SmsReceipt = z.infer<typeof SmsReceiptSchema>;

export function parseSmsCommand(body: string): SmsCommand {
  const parts = body.trim().toUpperCase().split(/\s+/u);
  const action = parts[0]?.toLowerCase();
  if (action === "help") return SmsCommandSchema.parse({ action: "help" });
  const code = parts[1];
  if (["start", "stop", "pause", "resume", "progress", "memory"].includes(action ?? "")) {
    return SmsCommandSchema.parse({ action, code });
  }
  if (action === "time") {
    return SmsCommandSchema.parse({ action, code, time: parts[2] });
  }
  if (action === "days") {
    return SmsCommandSchema.parse({ action, code, days: parts.slice(2) });
  }
  if (action === "delete") {
    return SmsCommandSchema.parse({
      action,
      code,
      confirm: parts[2] === "CONFIRM",
    });
  }
  throw new Error("Unknown SMS command.");
}

const GSM_BASIC = /^[\r\n !"#$%&'()*+,\-./0-9:;<=>?@A-Z_a-z¡-ÿ]*$/u;

export function smsSegmentInfo(text: string): {
  encoding: "gsm7" | "unicode";
  segments: number;
  characters: number;
} {
  const encoding = GSM_BASIC.test(text) ? "gsm7" : "unicode";
  const single = encoding === "gsm7" ? 160 : 70;
  const multipart = encoding === "gsm7" ? 153 : 67;
  const characters = [...text].length;
  return {
    encoding,
    characters,
    segments:
      characters <= single ? 1 : Math.ceil(characters / multipart),
  };
}
