import { describe, expect, it } from "vitest";
import { renderLandingPage } from "../src/landing/page.js";

describe("Continuum landing page", () => {
  it("makes the feature-phone classroom and honest release state visible", () => {
    const page = renderLandingPage({
      phoneReady: false,
      missedCallEnabled: false,
      guidedSubjects: ["Math"],
    });
    expect(page).toContain("The call is the classroom");
    expect(page).toContain("No smartphone. No app. No camera. No internet");
    expect(page).toContain("Judge phone access is being verified");
    expect(page).toContain("Math");
    expect(page).toContain("extends teachers and schools");
    expect(page).toContain("prefers-reduced-motion");
  });

  it("publishes the missed-call CTA only after the phone gate", () => {
    const page = renderLandingPage({
      phoneNumber: "+14155550100",
      phoneReady: true,
      missedCallEnabled: true,
      guidedSubjects: ["Math", "Science"],
    });
    expect(page).toContain('href="tel:+14155550100"');
    expect(page).toContain("Give a missed call");
    expect(page).toContain("Math · Science");
  });
});
