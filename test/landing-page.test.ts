import { describe, expect, it } from "vitest";
import { renderLandingPage } from "../src/landing/page.js";

describe("Continuum landing page", () => {
  it("makes the feature-phone classroom and honest release state visible", () => {
    const page = renderLandingPage({
      phoneReady: false,
      missedCallEnabled: false,
    });
    expect(page).toContain("The call is the classroom");
    expect(page).toContain("No smartphone. No app. No camera. No internet");
    expect(page).toContain("Judge phone access is being verified");
    expect(page).toContain("What would you like to learn?");
    expect(page).toContain("It speaks your language");
    expect(page).toContain("It remembers and resumes");
    expect(page).toContain("It stays a teacher");
    expect(page).toContain("Lesson paused.<br>Call back anytime.");
    expect(page).toContain("extends teachers and schools");
    expect(page).toContain("prefers-reduced-motion");
  });

  it("publishes the missed-call CTA only after the phone gate", () => {
    const page = renderLandingPage({
      phoneNumber: "+14155550100",
      phoneReady: true,
      missedCallEnabled: true,
    });
    expect(page).toContain('href="tel:+14155550100"');
    expect(page).toContain("Give a missed call");
    expect(page).toContain("A teacher.<br>Any phone.");
    expect(page).not.toContain("Reviewed guided menu");
  });
});
