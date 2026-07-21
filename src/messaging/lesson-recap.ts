import { smsSegmentInfo } from "../domain/sms-control.js";
import { redactPotentialPii } from "../privacy/redact-pii.js";

export function buildLessonRecapSms(options: {
  topic: string;
  understanding: "needs_support" | "developing" | "secure";
}): string {
  const understanding = options.understanding.replace("_", " ");
  let topic = redactPotentialPii(options.topic)
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, 80);
  while (topic.length > 0) {
    const message = `Today: ${topic}. Understanding: ${understanding}. Call Continuum to continue.`;
    if (smsSegmentInfo(message).segments === 1) return message;
    topic = topic.slice(0, -1).trimEnd();
  }
  return "Your Continuum lesson was saved. Call when you want to continue.";
}
