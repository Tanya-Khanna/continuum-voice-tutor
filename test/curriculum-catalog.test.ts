import { describe, expect, it } from "vitest";
import { CurriculumCatalog } from "../src/curriculum/catalog.js";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";

function pack(options: {
  id: string;
  subject: string;
  countryCode?: string;
  grade?: number;
}) {
  return CurriculumPackSchema.parse({
    ...fractionsPack,
    id: options.id,
    deployment: {
      ...fractionsPack.deployment,
      subject: options.subject,
      countryCode:
        options.countryCode ?? fractionsPack.deployment.countryCode,
      grade: options.grade ?? fractionsPack.deployment.grade,
    },
  });
}

describe("CurriculumCatalog", () => {
  it("preserves configured order and resolves subjects case-insensitively", () => {
    const science = pack({ id: "science-pack", subject: "Science" });
    const catalog = new CurriculumCatalog([fractionsPack, science]);

    expect(catalog.subjects()).toEqual(["Math", "Science"]);
    expect(catalog.defaultOption.id).toBe(fractionsPack.id);
    expect(catalog.requireBySubject(" science ").id).toBe("science-pack");
    expect(catalog.requireByPackId(fractionsPack.id).subject).toBe("Math");
  });

  it("rejects empty, duplicate, and cross-deployment catalogs", () => {
    expect(() => new CurriculumCatalog([])).toThrow(/at least one/u);
    expect(() =>
      new CurriculumCatalog([
        fractionsPack,
        pack({ id: "other-math", subject: "math" }),
      ]),
    ).toThrow(/Duplicate curriculum subject/u);
    expect(() =>
      new CurriculumCatalog([
        fractionsPack,
        pack({ id: fractionsPack.id, subject: "Science" }),
      ]),
    ).toThrow(/Duplicate curriculum pack id/u);
    expect(() =>
      new CurriculumCatalog([
        fractionsPack,
        pack({ id: "science-ke", subject: "Science", countryCode: "KE" }),
      ]),
    ).toThrow(/does not match deployment/u);
  });

  it("fails closed for an unavailable spoken subject", () => {
    const catalog = new CurriculumCatalog([fractionsPack]);
    expect(() => catalog.requireBySubject("History")).toThrow(
      /Available subjects: Math/u,
    );
  });
});
