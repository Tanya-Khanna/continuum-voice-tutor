import { describe, expect, it } from "vitest";
import { evaluatePlacement } from "../src/engine/placement-diagnostic.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";

describe("placement diagnostic", () => {
  it("places a learner with consistent reasoning at grade-ready", () => {
    const result = evaluatePlacement(fractionsPack, [
      { questionId: "equal_shares", answer: "Each person gets one half." },
      {
        questionId: "compare_halves_quarters",
        answer: "One half, because two pieces means each is a bigger piece.",
      },
      {
        questionId: "compare_thirds_fifths",
        answer: "One third, because fewer pieces makes a bigger piece.",
      },
    ]);

    expect(result.level).toBe("grade_ready");
    expect(result.score).toBe(3);
  });

  it("starts a learner without fraction evidence at equal shares", () => {
    const result = evaluatePlacement(fractionsPack, [
      { questionId: "equal_shares", answer: "I do not know." },
      { questionId: "compare_halves_quarters", answer: "Four is bigger." },
      { questionId: "compare_thirds_fifths", answer: "Maybe one fifth." },
    ]);

    expect(result.level).toBe("foundational");
    expect(result.recommendedConcept).toBe("equal_shares");
  });
});
