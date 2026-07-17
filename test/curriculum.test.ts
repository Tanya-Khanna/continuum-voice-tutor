import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";

describe("frozen fractions curriculum", () => {
  it("validates as a reviewable curriculum pack", () => {
    expect(CurriculumPackSchema.parse(fractionsPack)).toEqual(fractionsPack);
  });

  it("contains the canonical denominator misconception", () => {
    const misconceptions = fractionsPack.concepts.flatMap(
      (concept) => concept.misconceptions,
    );
    expect(
      misconceptions.some(
        (item) => item.id === "larger_denominator_means_larger_fraction",
      ),
    ).toBe(true);
  });
});
