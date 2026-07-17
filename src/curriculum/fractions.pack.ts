import { CurriculumPackSchema } from "./schema.js";

export const fractionsPack = CurriculumPackSchema.parse({
  id: "india-ncert-grade-6-fractions",
  version: "0.1.0-hand-verified",
  deployment: {
    country: "India",
    grade: 6,
    languages: ["English", "Hindi", "Hinglish"],
    syllabus: "NCERT-aligned prototype pack",
  },
  concepts: [
    {
      id: "comparing_unit_fractions",
      title: "Comparing unit fractions",
      grade: 6,
      learningObjective:
        "Explain why a unit fraction with a smaller denominator is larger when the wholes are equal.",
      verifiedFacts: [
        "A unit fraction has one as its numerator.",
        "For equal wholes, dividing into more equal parts makes each part smaller.",
        "One third is greater than one fourth when the wholes are equal.",
      ],
      misconceptions: [
        {
          id: "larger_denominator_means_larger_fraction",
          signals: [
            "four is bigger than three",
            "4 is bigger than 3",
            "bigger denominator",
            "one fourth is bigger",
            "one-fourth is bigger",
          ],
          diagnosis:
            "The learner is comparing denominator numerals instead of the size of the equal pieces.",
          strategy:
            "Use equal rotis split among three and four people, then ask which person receives more.",
        },
      ],
      concreteAnalogies: [
        "Share one same-sized roti equally among three people, then another same-sized roti among four people.",
        "Fold two equal sheets of paper into three and four equal parts and compare one part from each.",
      ],
      retrievalQuestions: [
        "If two rotis are the same size, is one third or one fourth the bigger share? Why?",
        "As the number of equal pieces increases, what happens to each piece?",
      ],
    },
  ],
});

export const comparingUnitFractions = fractionsPack.concepts[0]!;
