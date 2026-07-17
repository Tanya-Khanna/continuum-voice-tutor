import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CurriculumSourceBriefDraftSchema,
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
  review: {
    status: "approved",
    reviewedBy: "Test reviewer",
    reviewedAt: "2026-07-17T00:00:00.000Z",
    reviewedSourceUrls: ["https://example.edu/curriculum"],
    scopeNotes: ["The themes and required concepts match the source."],
  },
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

  it("allows draft validation but blocks compilation without human approval", () => {
    const { review: _review, ...pendingBrief } = sourceBrief;
    expect(CurriculumSourceBriefDraftSchema.parse(pendingBrief).review).toEqual({
      status: "pending",
      notes: [],
    });
    expect(() => CurriculumSourceBriefSchema.parse(pendingBrief)).toThrow();
  });

  it("requires the approval receipt to cover the exact source set", () => {
    expect(() =>
      CurriculumSourceBriefSchema.parse({
        ...sourceBrief,
        review: {
          ...sourceBrief.review,
          reviewedSourceUrls: ["https://example.edu/another-source"],
        },
      }),
    ).toThrow(/cover every source URL/u);
  });

  it("rejects mismatched subject metadata before model spend", () => {
    expect(() =>
      CurriculumSourceBriefSchema.parse({
        ...sourceBrief,
        deployment: { ...sourceBrief.deployment, subject: "Geography" },
      }),
    ).toThrow(/subjects must match/u);
  });

  it("keeps hand-verified provenance on the flagship pack", () => {
    expect(CurriculumPackSchema.parse(fractionsPack).provenance).toEqual({
      method: "hand_verified",
      sourceMaterials: [],
    });
  });

  it("requires an auditable human receipt on compiled-pack provenance", () => {
    expect(() =>
      CurriculumPackSchema.parse({
        ...fractionsPack,
        provenance: {
          method: "compiled",
          sourceMaterials: [
            {
              title: "Official curriculum outline",
              url: "https://example.edu/curriculum",
            },
          ],
          generatedByModel: "compiler-model",
          verifiedByModel: "verifier-model",
        },
      }),
    ).toThrow();

    expect(
      CurriculumPackSchema.parse({
        ...fractionsPack,
        provenance: {
          method: "compiled",
          sourceMaterials: [
            {
              title: "Official curriculum outline",
              url: "https://example.edu/curriculum",
            },
          ],
          generatedByModel: "compiler-model",
          verifiedByModel: "verifier-model",
          humanReview: {
            reviewedBy: "Test reviewer",
            reviewedAt: "2026-07-17T00:00:00.000Z",
            scopeNotes: ["Confirmed the bounded source themes."],
          },
        },
      }).provenance,
    ).toMatchObject({ method: "compiled", generatedByModel: "compiler-model" });
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
