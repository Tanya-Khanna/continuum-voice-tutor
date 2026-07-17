import { describe, expect, it } from "vitest";
import { fractionsPack } from "../src/curriculum/fractions.pack.js";
import { CurriculumPackSchema } from "../src/curriculum/schema.js";
import { CurriculumTeachingEngine } from "../src/engine/curriculum-teaching-engine.js";
import { ConfiguredLanguageDetector } from "../src/language/language-detector.js";

const baseConcept = fractionsPack.concepts[0]!;
const sciencePack = CurriculumPackSchema.parse({
  ...fractionsPack,
  id: "example-grade-6-science",
  deployment: {
    ...fractionsPack.deployment,
    country: "Example deployment",
    countryCode: "KE",
    subject: "Science",
    defaultLanguage: "sw",
    testedLanguageModes: ["sw", "en"],
    offlineLanguageHints: [],
    syllabus: "Example science syllabus",
  },
  placementDiagnostic: {
    ...fractionsPack.placementDiagnostic,
    recommendations: {
      foundational: "states_of_matter",
      developing: "states_of_matter",
      grade_ready: "states_of_matter",
    },
  },
  concepts: [
    {
      ...baseConcept,
      id: "states_of_matter",
      title: "States of matter",
      learningObjective: "Explain that gases occupy space and have mass.",
      verifiedFacts: ["Gases occupy space.", "Gases have mass."],
      vocabularyBridges: [
        {
          canonicalTerm: "mass",
          termLanguage: "en",
          spokenDefinition: "the amount of matter in something",
          informalSignals: ["heaviness"],
          offlineBridgeLead:
            "Your word heaviness connects to the curriculum word mass: the amount of matter in something.",
        },
      ],
      misconceptions: [
        {
          id: "gas_has_no_mass",
          signals: ["gas has no mass"],
          diagnosis: "The learner treats invisible matter as having no mass.",
          strategy: "concrete_analogy",
          masteryEvidence: "The learner equates invisibility with absence of mass.",
          responseLead: "Let us test that with two balloons.",
          nextQuestion:
            "If one balloon is inflated and one is empty, which would make a balance tip?",
        },
      ],
      concreteAnalogies: ["Compare an inflated balloon with an empty balloon."],
      retrievalQuestions: ["How could a balance show that air has mass?"],
      teachingScaffold: {
        ...baseConcept.teachingScaffold,
        entryQuestion: "Does air take up space and have mass? Explain.",
        evidenceRules: [
          {
            answerSignals: ["air has mass"],
            reasoningSignals: ["balloon", "balance"],
            diagnosis: "The learner connects evidence from a balance to gas mass.",
            masteryEvidence: "The learner used observable evidence.",
            responseLead: "Good evidence.",
            nextQuestion: "How could you show that air also takes up space?",
          },
        ],
        fallbackDiagnosis: "The learner has not yet provided observable evidence.",
        fallbackEvidence: "No testable explanation was provided.",
        fallbackResponseLead: "Let us think of something we can observe.",
        fallbackQuestion: "What changes when you inflate a balloon?",
      },
    },
  ],
});

describe("CurriculumTeachingEngine", () => {
  it("teaches a non-math concept without changing engine code", async () => {
    const engine = new CurriculumTeachingEngine({
      pack: sciencePack,
      languageDetector: new ConfiguredLanguageDetector(sciencePack.deployment),
    });
    const turn = await engine.teach({
      learnerId: "amani",
      concept: "states_of_matter",
      learnerAnswer: "Gas has no mass because I cannot see it.",
      requestedLanguageMode: "fr",
    });

    expect(turn.next_strategy).toBe("concrete_analogy");
    expect(turn.diagnosis).toContain("invisible matter");
    expect(turn.spoken_response).toContain("balloons");
    expect(turn.spoken_response).not.toContain("fraction");
    expect(turn.language_mode).toBe("fr");
  });

  it("uses each pack's vocabulary bridge without a language-pair rule in the engine", async () => {
    const engine = new CurriculumTeachingEngine({
      pack: sciencePack,
      languageDetector: new ConfiguredLanguageDetector(sciencePack.deployment),
    });
    const turn = await engine.teach({
      learnerId: "amani",
      concept: "states_of_matter",
      learnerAnswer: "Maybe air has heaviness when the balloon fills.",
      requestedLanguageMode: "sw+en",
    });

    expect(turn.spoken_response).toContain("curriculum word mass");
    expect(turn.spoken_response).not.toContain("denominator");
    expect(turn.language_mode).toBe("sw+en");
  });
});
