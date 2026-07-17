import { CurriculumPackSchema } from "./schema.js";

export const fractionsPack = CurriculumPackSchema.parse({
  id: "india-ncert-grade-6-fractions",
  version: "0.1.0-hand-verified",
  provenance: {
    method: "hand_verified",
    sourceMaterials: [],
  },
  deployment: {
    country: "India",
    countryCode: "IN",
    subject: "Math",
    grade: 6,
    defaultLanguage: "en",
    languagePolicy: "model_detect_any",
    testedLanguageModes: ["en", "hi", "hi-Latn+en"],
    offlineLanguageHints: [
      {
        languageMode: "hi",
        signals: ["बताओ", "क्योंकि", "नहीं"],
        patterns: ["[\\u0900-\\u097f]"],
      },
      {
        languageMode: "hi-Latn+en",
        signals: [
          "mujhe",
          "lagta",
          "samajh",
          "nahi",
          "pata",
          "bata",
          "bas",
          "kyunki",
          "bada",
          "chhota",
          "hai",
          "roti",
        ],
        patterns: [],
      },
      {
        languageMode: "es",
        signals: ["no entiendo"],
        patterns: [],
      },
      {
        languageMode: "es+en",
        signals: ["pienso", "porque"],
        patterns: [],
      },
      {
        languageMode: "sw",
        signals: ["sielewi", "kwa sababu"],
        patterns: [],
      },
      {
        languageMode: "ta",
        signals: ["புரியவில்லை", "எனக்கு"],
        patterns: ["[\\u0b80-\\u0bff]"],
      },
    ],
    syllabus: "NCERT-aligned prototype pack",
  },
  placementDiagnostic: {
    questions: [
      {
        id: "equal_shares",
        prompt:
          "One roti is shared equally between two people. What share does each person get?",
        answerSignals: ["one half", "one-half", "half", "aadha", "आधा"],
        reasoningSignals: [],
      },
      {
        id: "compare_halves_quarters",
        prompt:
          "Which is larger, one half or one fourth? Tell me how you know.",
        answerSignals: ["one half", "one-half", "half"],
        reasoningSignals: ["bigger piece", "fewer pieces", "two pieces"],
      },
      {
        id: "compare_thirds_fifths",
        prompt:
          "Which is larger, one third or one fifth? Tell me what happens to each piece.",
        answerSignals: ["one third", "one-third"],
        reasoningSignals: [
          "bigger piece",
          "fewer pieces",
          "more pieces smaller",
        ],
      },
    ],
    developingMinimum: 1,
    gradeReadyMinimum: 3,
    recommendations: {
      foundational: "equal_shares",
      developing: "comparing_unit_fractions",
      grade_ready: "comparing_unit_fractions",
    },
  },
  lessonPolicy: {
    targetTurns: 8,
    recentDropRecoveryMinutes: 15,
    recentResumeLead:
      "Welcome back. We can continue exactly where the call stopped.",
    returnRetrievalLead:
      "Welcome back. Let us warm up with one question from last time.",
    recapResponseLead:
      "Nice work today. You kept explaining your thinking and testing your ideas.",
    callAgainInvitation:
      "Call again when you are ready for the next step.",
  },
  safetyPolicy: {
    unsafeSignals: [
      "hurt someone",
      "hurt myself",
      "make a weapon",
      "send me a nude",
    ],
    promptInjectionSignals: [
      "ignore your instructions",
      "reveal your system prompt",
      "pretend there is no curriculum",
      "developer message says",
    ],
    offTopicSignals: [
      "celebrity gossip",
      "sports score",
      "write my social media post",
      "tell me a random joke",
    ],
    unsafeDiagnosis:
      "The learner requested unsafe or age-inappropriate assistance.",
    unsafeResponseLead:
      "I cannot help with anything that could hurt you or someone else. Please talk to a trusted adult or local emergency service now if anyone is in immediate danger.",
    promptInjectionDiagnosis:
      "The learner attempted to override the tutor's curriculum or safety instructions.",
    promptInjectionResponseLead:
      "I cannot change or reveal my private instructions, but I can keep helping with the lesson.",
    offTopicDiagnosis:
      "The learner moved to a benign request outside the selected lesson.",
    offTopicResponseLead:
      "That is outside this lesson, so let us return to the idea we were working on.",
    gracefulEndResponse:
      "I am going to end this lesson for now. You can call again when you are ready to learn safely.",
    maxConsecutiveRedirects: 2,
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
      vocabularyBridges: [
        {
          canonicalTerm: "denominator",
          termLanguage: "en",
          spokenDefinition:
            "the number that tells how many equal parts make the whole",
          informalSignals: [
            "bottom number",
            "number underneath",
            "neeche wala number",
          ],
          offlineBridgeLead:
            "You described the bottom number. The curriculum word is denominator: the number that tells how many equal parts make the whole.",
        },
        {
          canonicalTerm: "unit fraction",
          termLanguage: "en",
          spokenDefinition:
            "a fraction that names one equal part of a whole",
          informalSignals: ["one piece out of", "one equal piece", "one on top"],
          offlineBridgeLead:
            "You described one equal piece. The curriculum phrase is unit fraction: one equal part of a whole.",
        },
      ],
      verifiedRationalComparisons: [
        {
          id: "one_third_greater_than_one_fourth",
          claim: "One third is greater than one fourth for equal wholes.",
          left: { numerator: 1, denominator: 3 },
          relation: "gt",
          right: { numerator: 1, denominator: 4 },
        },
        {
          id: "one_fifth_greater_than_one_eighth",
          claim: "One fifth is greater than one eighth for equal wholes.",
          left: { numerator: 1, denominator: 5 },
          relation: "gt",
          right: { numerator: 1, denominator: 8 },
        },
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
          strategy: "concrete_analogy",
          masteryEvidence: "The answer uses denominator size as fraction size.",
          responseLead: "Good, let us test that idea with same-sized rotis.",
          nextQuestion:
            "One equal roti is shared by three people and another by four. Which person gets the larger piece, and why?",
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
      teachingScaffold: {
        entryQuestion:
          "Which is the bigger share, one third or one fourth? Tell me why.",
        silenceQuestion:
          "Imagine one roti shared equally by three people. How many equal pieces would you make?",
        silenceResponseLead: "That is okay. We can start small.",
        answerRequestSignals: [
          "just tell",
          "give me the answer",
          "answer bata",
          "bas bata",
        ],
        answerRequestDiagnosis:
          "The learner requested the result without showing reasoning.",
        answerRequestEvidence: "No mathematical reasoning was provided.",
        answerRequestResponseLead:
          "I will help you work it out, not leave you with a guess.",
        answerRequestQuestion:
          "If the same whole is shared among more people, does each person receive more or less?",
        evidenceRules: [
          {
            answerSignals: ["one third", "one-third", "1/3"],
            reasoningSignals: [
              "fewer pieces",
              "less pieces",
              "three people",
              "bigger piece",
              "four pieces are smaller",
              "more people",
              "kam log",
              "teen log",
            ],
            diagnosis:
              "The learner correctly connects denominator size with equal-piece size.",
            masteryEvidence:
              "The learner chose one third and justified it using piece size.",
            responseLead: "Exactly. More equal pieces make each piece smaller.",
            nextQuestion:
              "Now compare one fifth and one eighth. Which share is larger, and what rule are you using?",
          },
        ],
        fallbackDiagnosis:
          "The response does not yet show enough evidence to identify stable understanding.",
        fallbackEvidence:
          "The learner has not explained the role of the denominators.",
        fallbackResponseLead: "Let us look at what the numbers mean.",
        fallbackQuestion:
          "What do the three and four tell us about how many equal pieces each whole was split into?",
      },
    },
    {
      id: "equal_shares",
      title: "Making equal shares",
      grade: 6,
      learningObjective:
        "Explain that one half is one of two equal shares of the same whole.",
      verifiedFacts: [
        "Equal shares of the same whole have the same size.",
        "One of two equal shares is one half.",
        "Two halves make one whole.",
      ],
      vocabularyBridges: [
        {
          canonicalTerm: "equal shares",
          termLanguage: "en",
          spokenDefinition:
            "parts of the same whole that have exactly the same size",
          informalSignals: ["same amount", "same size for both", "fair pieces"],
          offlineBridgeLead:
            "You described the same amount for each person. The curriculum phrase is equal shares: parts of one whole with exactly the same size.",
        },
      ],
      verifiedRationalComparisons: [
        {
          id: "two_halves_equal_one_whole",
          claim: "Two halves make one whole.",
          left: { numerator: 2, denominator: 2 },
          relation: "eq",
          right: { numerator: 1, denominator: 1 },
        },
      ],
      misconceptions: [
        {
          id: "two_parts_are_automatically_halves",
          signals: [
            "any two pieces",
            "two pieces means half",
            "does not matter if equal",
          ],
          diagnosis:
            "The learner calls two unequal pieces halves without checking equal size.",
          strategy: "contrast_cases",
          masteryEvidence:
            "The learner identified the number of pieces but not the equal-share condition.",
          responseLead:
            "Two pieces are not always two halves, so let us compare two ways of sharing.",
          nextQuestion:
            "If one person gets a tiny piece and another gets a large piece, did they receive equal halves? Why not?",
        },
      ],
      concreteAnalogies: [
        "Fold one sheet so both edges meet, then compare the two parts.",
        "Share one same-sized flatbread equally between two people.",
      ],
      retrievalQuestions: [
        "What must be true before two pieces can be called halves?",
        "If two people receive equal shares of one whole, what fraction does each receive?",
      ],
      teachingScaffold: {
        entryQuestion:
          "One flatbread is shared equally between two people. What share does each person receive, and what makes the sharing fair?",
        silenceQuestion:
          "If you fold a sheet so its two edges meet, how many equal parts do you see?",
        silenceResponseLead: "That is okay. Let us make it concrete.",
        answerRequestSignals: [
          "just tell",
          "give me the answer",
          "answer bata",
          "bas bata",
        ],
        answerRequestDiagnosis:
          "The learner requested the fraction name without reasoning about equality.",
        answerRequestEvidence: "No equal-share reasoning was provided.",
        answerRequestResponseLead:
          "I will help you see it instead of asking you to memorize it.",
        answerRequestQuestion:
          "What would you check to make sure both people received the same amount?",
        evidenceRules: [
          {
            answerSignals: ["one half", "one-half", "half", "aadha", "आधा"],
            reasoningSignals: [
              "equal",
              "same size",
              "same amount",
              "fair",
              "barabar",
            ],
            diagnosis:
              "The learner connects the fraction one half with two equal shares.",
            masteryEvidence:
              "The learner named one half and justified it using equal size.",
            responseLead:
              "Exactly. One half means one of two equal shares of the same whole.",
            nextQuestion:
              "If the two pieces are different sizes, can either piece be called one half? Why?",
          },
        ],
        fallbackDiagnosis:
          "The response does not yet show that the learner understands equal shares.",
        fallbackEvidence:
          "The learner has not connected the word half with two equal parts.",
        fallbackResponseLead: "Let us focus on the word equal.",
        fallbackQuestion:
          "How could you check whether both pieces are exactly the same size?",
      },
    },
  ],
});

export const comparingUnitFractions = fractionsPack.concepts[0]!;
