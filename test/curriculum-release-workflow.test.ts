import { describe, expect, it } from "vitest";
import {
  PACK_SPOT_CHECK_CONFIRMATION,
  SOURCE_REVIEW_CONFIRMATION,
  approveCurriculumSourceBrief,
  artifactSha256,
  assertPackRelease,
  createCompileReceipt,
  createCurriculumReleaseReceipt,
} from "../src/compiler/release-workflow.js";
import { CurriculumSourceBriefDraftSchema } from "../src/compiler/schema.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";

const draft = CurriculumSourceBriefDraftSchema.parse({
  id: "reviewed-math-brief",
  subject: "Math",
  deployment: {
    country: "India",
    countryCode: "IN",
    subject: "Math",
    grade: 6,
    defaultLanguage: "hi-Latn+en",
    testedLanguageModes: ["hi-Latn+en", "en"],
    syllabus: "Reviewed test syllabus",
  },
  sourceMaterials: [
    {
      title: "Official source",
      url: "https://example.edu/math",
      themes: ["fractions"],
    },
  ],
  requiredConcepts: ["comparing unit fractions"],
  requiredVocabulary: [
    {
      conceptId: "comparing_unit_fractions",
      canonicalTerm: "denominator",
      termLanguage: "en",
      meaning: "the number that tells how many equal parts make the whole",
    },
  ],
  originalityRequirements: ["Use original wording."],
});

function compiledPack() {
  return CurriculumPackSchema.parse({
    ...fractionsPack,
    provenance: {
      method: "compiled",
      sourceMaterials: [
        { title: "Official source", url: "https://example.edu/math" },
      ],
      generatedByModel: "compiler",
      verifiedByModel: "verifier",
      humanReview: {
        reviewedBy: "Reviewer",
        reviewedAt: "2026-07-20T00:00:00.000Z",
        scopeNotes: ["Checked scope."],
      },
    },
  });
}

describe("curriculum release workflow", () => {
  it("requires an explicit human source-review confirmation", () => {
    expect(() =>
      approveCurriculumSourceBrief({
        draft,
        reviewedBy: "Reviewer",
        reviewedAt: "2026-07-20T00:00:00.000Z",
        scopeNotes: ["Checked scope."],
        confirmation: "automatic",
      }),
    ).toThrow(/exact confirmation/u);

    const approved = approveCurriculumSourceBrief({
      draft,
      reviewedBy: "Reviewer",
      reviewedAt: "2026-07-20T00:00:00.000Z",
      scopeNotes: ["Checked scope."],
      confirmation: SOURCE_REVIEW_CONFIRMATION,
    });
    expect(approved.review.reviewedSourceUrls).toEqual([
      "https://example.edu/math",
    ]);
  });

  it("binds compile and release receipts to exact artifacts", () => {
    const brief = approveCurriculumSourceBrief({
      draft,
      reviewedBy: "Reviewer",
      reviewedAt: "2026-07-20T00:00:00.000Z",
      scopeNotes: ["Checked scope."],
      confirmation: SOURCE_REVIEW_CONFIRMATION,
    });
    const pack = compiledPack();
    const compileReceipt = createCompileReceipt({
      brief,
      pack,
      verifiedAt: "2026-07-20T01:00:00.000Z",
      verification: {
        approved: true,
        checks: {
          source_grounded: true,
          original_wording: true,
          schema_complete: true,
          voice_friendly: true,
          answers_consistent: true,
          no_unreviewed_scope: true,
        },
        issues: [],
      },
    });
    const releaseReceipt = createCurriculumReleaseReceipt({
      brief,
      pack,
      compileReceipt,
      releasedBy: "Builder",
      releasedAt: "2026-07-20T02:00:00.000Z",
      notes: ["Checked every release item."],
      confirmation: PACK_SPOT_CHECK_CONFIRMATION,
    });

    expect(() =>
      assertPackRelease({ brief, pack, compileReceipt, releaseReceipt }),
    ).not.toThrow();
    expect(releaseReceipt.packSha256).toBe(artifactSha256(pack));
    expect(() =>
      assertPackRelease({
        brief,
        pack: CurriculumPackSchema.parse({ ...pack, version: "tampered" }),
        compileReceipt,
        releaseReceipt,
      }),
    ).toThrow(/does not match packVersion/u);
  });
});
