import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import {
  CurriculumPackSchema,
  evaluateRationalComparison,
} from "../src/curriculum/schema.js";
import {
  PersistedTeachingTurnSchema,
  TeachingTurnSchema,
} from "../src/domain/teaching.js";

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

  it("keeps canonical vocabulary and learner-language bridge hints in the pack", () => {
    const denominator = fractionsPack.concepts[0]!.vocabularyBridges.find(
      (bridge) => bridge.canonicalTerm === "denominator",
    );
    expect(denominator).toMatchObject({ termLanguage: "en" });
    expect(denominator?.informalSignals).toContain("neeche wala number");
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

  it("reads historical turns written before structured reasoning traces", () => {
    const historical = PersistedTeachingTurnSchema.parse({
      learner_id: "historical",
      concept: "comparing_unit_fractions",
      learner_answer: "One fourth.",
      diagnosis: "Historical diagnosis.",
      language_mode: "en",
      next_strategy: "ask_reasoning",
      mastery_status: "needs_support",
      mastery_evidence: "No reasoning recorded.",
      next_question: "Why?",
      spoken_response: "What makes you think that?",
      should_end_session: false,
    });
    expect(historical.reasoning_trace).toEqual([
      {
        source: "tutor_inference",
        claim: "Historical diagnosis.",
        status: "unclear",
      },
    ]);
    expect(historical.anchor_object).toBeNull();
  });

  it("keeps the auditable live teaching contract compatible with Structured Outputs", () => {
    expect(() => zodTextFormat(TeachingTurnSchema, "teaching_turn")).not.toThrow();
  });
});
