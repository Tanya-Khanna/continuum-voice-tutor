import { describe, expect, it } from "vitest";
import { smsSegmentInfo } from "../src/domain/sms-control.js";
import { buildLessonRecapSms } from "../src/messaging/lesson-recap.js";

describe("feature-phone lesson recap", () => {
  it("fits both GSM and Unicode topics into one segment", () => {
    for (const topic of [
      "why shadows change length",
      "भिन्न और दशमलव को समझना और परीक्षा की तैयारी",
    ]) {
      const recap = buildLessonRecapSms({
        topic,
        understanding: "developing",
      });
      expect(smsSegmentInfo(recap).segments).toBe(1);
      expect(recap).toContain("Continuum");
    }
  });

  it("redacts private contact details", () => {
    expect(
      buildLessonRecapSms({
        topic: "algebra with child@example.com",
        understanding: "needs_support",
      }),
    ).not.toContain("child@example.com");
  });
});
