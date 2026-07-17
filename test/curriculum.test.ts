import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import {
  CurriculumPackSchema,
  evaluateRationalComparison,
} from "../src/curriculum/schema.js";

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

  it("machine-verifies every declared rational comparison", () => {
    const comparisons = fractionsPack.concepts.flatMap(
      (concept) => concept.verifiedRationalComparisons,
    );
    expect(comparisons.length).toBeGreaterThan(0);
    expect(comparisons.every(evaluateRationalComparison)).toBe(true);
  });

  it("rejects a frozen pack containing a false verified math claim", () => {
    const firstConcept = fractionsPack.concepts[0]!;
    expect(() =>
      CurriculumPackSchema.parse({
        ...fractionsPack,
        concepts: [
          {
            ...firstConcept,
            verifiedRationalComparisons: [
              {
                id: "false_claim",
                claim: "One fourth is greater than one third.",
                left: { numerator: 1, denominator: 4 },
                relation: "gt",
                right: { numerator: 1, denominator: 3 },
              },
            ],
          },
        ],
      }),
    ).toThrow(/false/u);
  });

  it("rejects placement recommendations for missing concepts", () => {
    expect(() =>
      CurriculumPackSchema.parse({
        ...fractionsPack,
        placementDiagnostic: {
          ...fractionsPack.placementDiagnostic,
          recommendations: {
            ...fractionsPack.placementDiagnostic.recommendations,
            foundational: "missing_concept",
          },
        },
      }),
    ).toThrow(/not a curriculum concept/u);
  });
});
