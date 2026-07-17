import { describe, expect, it } from "vitest";
import {
  CurriculumSourceBriefSchema,
  CurriculumVerificationSchema,
} from "../src/compiler/schema.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";

const sourceBrief = {
  id: "example-science-brief",
  subject: "Science",
  deployment: {
    country: "Example deployment",
    countryCode: "KE",
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
