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
  ReviewedKeypadQuestionSchema,
} from "../src/curriculum/schema.js";
import {
  assertPackMatchesBrief,
  assertRequiredVocabulary,
  curriculumDraftTextFormat,
  preserveReviewedVocabulary,
} from "../src/compiler/openai-curriculum-compiler.js";

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
    const rawFormat = zodTextFormat(
      CurriculumPackDraftSchema,
      "curriculum_pack_draft",
    );
    expect(JSON.stringify(rawFormat.schema)).toContain('"pattern"');

    const apiFormat = curriculumDraftTextFormat();
    expect(JSON.stringify(apiFormat.schema)).not.toContain('"pattern"');
    expect("$parseRaw" in apiFormat).toBe(true);
  });

  it("requires feature-phone SMS copy to enumerate every keypad option", () => {
    expect(() =>
      ReviewedKeypadQuestionSchema.parse({
        id: "missing-third-choice",
        prompt: "Which option is correct?",
        featurePhoneSms: "Choose 1 first or 2 second",
        choices: [
          { id: "first", label: "First", correct: true },
          { id: "second", label: "Second", correct: false },
          { id: "third", label: "Third", correct: false },
        ],
      }),
    ).toThrow(/option 3/u);
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

  it("preserves reviewed vocabulary verbatim without inventing teaching copy", () => {
    const reviewedBrief = CurriculumSourceBriefSchema.parse({
      ...sourceBrief,
      subject: "Math",
      deployment: {
        ...sourceBrief.deployment,
        country: fractionsPack.deployment.country,
        countryCode: fractionsPack.deployment.countryCode,
        subject: fractionsPack.deployment.subject,
        grade: fractionsPack.deployment.grade,
        defaultLanguage: fractionsPack.deployment.defaultLanguage,
        testedLanguageModes: fractionsPack.deployment.testedLanguageModes,
        syllabus: fractionsPack.deployment.syllabus,
      },
      requiredConcepts: fractionsPack.concepts.map((concept) => concept.id),
      requiredVocabulary: [
        {
          conceptId: "comparing_unit_fractions",
          canonicalTerm: "DENOMINATOR",
          termLanguage: "en",
          meaning: "the reviewed exact meaning",
        },
      ],
    });
    const { provenance: _provenance, ...draft } = fractionsPack;
    const originalLead = draft.concepts[0]?.vocabularyBridges[0]?.offlineBridgeLead;
    const preserved = preserveReviewedVocabulary(reviewedBrief, draft);
    const bridge = preserved.concepts[0]?.vocabularyBridges[0];
    expect(bridge).toMatchObject({
      canonicalTerm: "DENOMINATOR",
      spokenDefinition: "the reviewed exact meaning",
      offlineBridgeLead: originalLead,
    });
    expect(draft.concepts[0]?.vocabularyBridges[0]?.canonicalTerm).toBe(
      "denominator",
    );
  });

  it("fails closed when compiled deployment or concept scope diverges", () => {
    const matchingBrief = CurriculumSourceBriefSchema.parse({
      ...sourceBrief,
      subject: "Math",
      deployment: {
        ...sourceBrief.deployment,
        country: fractionsPack.deployment.country,
        countryCode: fractionsPack.deployment.countryCode,
        subject: fractionsPack.deployment.subject,
        grade: fractionsPack.deployment.grade,
        defaultLanguage: fractionsPack.deployment.defaultLanguage,
        testedLanguageModes: fractionsPack.deployment.testedLanguageModes,
        syllabus: fractionsPack.deployment.syllabus,
      },
      requiredConcepts: fractionsPack.concepts.map((concept) => concept.id),
    });
    expect(() => assertPackMatchesBrief(matchingBrief, fractionsPack)).not.toThrow();
    expect(() =>
      assertPackMatchesBrief(
        {
          ...matchingBrief,
          requiredConcepts: ["unreviewed_concept"],
        },
        fractionsPack,
      ),
    ).toThrow(/concept IDs/u);
    expect(() =>
      assertPackMatchesBrief(matchingBrief, {
        ...fractionsPack,
        deployment: { ...fractionsPack.deployment, subject: "Science" },
      }),
    ).toThrow(/deployment subject/u);
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

  it("keeps the verifier contract compatible with Structured Outputs", () => {
    const format = zodTextFormat(
      CurriculumVerificationSchema,
      "curriculum_verification",
    );
    expect(format.schema).toMatchObject({
      type: "object",
      required: ["approved", "checks", "issues"],
    });
    expect(
      CurriculumVerificationSchema.parse({
        approved: false,
        checks: {
          source_grounded: false,
          original_wording: true,
          schema_complete: true,
          voice_friendly: true,
          answers_consistent: true,
          no_unreviewed_scope: true,
        },
        issues: [
          {
            severity: "error",
            code: "source_scope",
            message: "The issue applies to the pack as a whole.",
            conceptId: null,
          },
        ],
      }).issues[0]?.conceptId,
    ).toBeNull();
  });
});
