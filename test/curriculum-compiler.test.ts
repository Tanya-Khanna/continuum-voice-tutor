import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CurriculumSourceBriefSchema,
  CurriculumVerificationSchema,
} from "../src/compiler/schema.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import {
  CurriculumPackDraftSchema,
  CurriculumPackSchema,
} from "../src/curriculum/schema.js";
import { assertRequiredVocabulary } from "../src/compiler/openai-curriculum-compiler.js";

const sourceBrief = {
  id: "example-science-brief",
  subject: "Science",
  deployment: {
    country: "Example deployment",
    countryCode: "KE",
    subject: "Science",
    grade: 6,
    defaultLanguage: "sw",
    testedLanguageModes: ["sw", "en"],
    syllabus: "Reviewed example syllabus",
  },
  sourceMaterials: [
    {
      title: "Official curriculum outline",
      url: "https://example.edu/curriculum",
      themes: ["observable properties of matter"],
    },
  ],
  requiredConcepts: ["states of matter"],
  localContextNotes: ["Use household objects that require no purchase."],
  originalityRequirements: [
    "Generate original questions and explanations from themes only.",
  ],
};

describe("curriculum compiler contracts", () => {
  it("requires source provenance, bounded scope, and originality rules", () => {
    expect(CurriculumSourceBriefSchema.parse(sourceBrief)).toMatchObject({
      id: "example-science-brief",
      requiredConcepts: ["states of matter"],
    });
    expect(() =>
      CurriculumSourceBriefSchema.parse({
        ...sourceBrief,
        sourceMaterials: [],
      }),
    ).toThrow();
  });

  it("keeps hand-verified provenance on the flagship pack", () => {
    expect(CurriculumPackSchema.parse(fractionsPack).provenance).toEqual({
      method: "hand_verified",
      sourceMaterials: [],
    });
  });

  it("keeps the compiler draft compatible with Structured Outputs", () => {
    expect(() =>
      zodTextFormat(CurriculumPackDraftSchema, "curriculum_pack_draft"),
    ).not.toThrow();
  });

  it("fails closed when a compiled pack changes reviewed vocabulary", () => {
    const reviewedBrief = CurriculumSourceBriefSchema.parse({
      ...sourceBrief,
      requiredVocabulary: [
        {
          conceptId: "comparing_unit_fractions",
          canonicalTerm: "denominator",
          termLanguage: "en",
          meaning:
            "the number that tells how many equal parts make the whole",
        },
      ],
    });
    expect(() => assertRequiredVocabulary(reviewedBrief, fractionsPack)).not.toThrow();
    expect(() =>
      assertRequiredVocabulary(
        {
          ...reviewedBrief,
          requiredVocabulary: [
            {
              ...reviewedBrief.requiredVocabulary[0]!,
              canonicalTerm: "invented term",
            },
          ],
        },
        fractionsPack,
      ),
    ).toThrow(/missing reviewed vocabulary/u);
  });

  it("cannot approve a verifier result that omits required checks", () => {
    expect(() =>
      CurriculumVerificationSchema.parse({
        approved: true,
        checks: { source_grounded: true },
        issues: [],
      }),
    ).toThrow();
  });
});
