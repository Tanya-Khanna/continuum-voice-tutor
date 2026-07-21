import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CurriculumPackDraftSchema,
  CurriculumPackSchema,
  type CurriculumPack,
  type CurriculumPackDraft,
} from "../curriculum/schema.js";
import {
  CurriculumSourceBriefSchema,
  CurriculumVerificationSchema,
  type CurriculumSourceBrief,
  type CurriculumVerification,
} from "./schema.js";

const COMPILER_INSTRUCTIONS = `You compile a frozen voice-first Socratic curriculum pack from a reviewed source brief.
Use source themes only to determine scope and learning objectives. Write all questions, explanations, analogies, misconceptions, examples, verified facts, and wording originally; never reproduce source prose. Do not reuse a source theme's clause structure or make a near-synonym substitution. Express necessary facts with independently composed syntax and learner-facing language.
Stay within the stated grade, subject, required concepts, and source themes. Never add facts that cannot be supported by the brief.
Set deployment.subject to the reviewed source brief's subject exactly; voice menus are built from this metadata rather than a hardcoded subject list.
Make every learner-facing string short and natural aloud, so a composed teaching response remains at most three sentences with exactly one question. Recap and safety-ending copy has no spoken question. Use no Markdown, symbolic fractions, or unexplained notation.
Keep language detection universal: languagePolicy must be model_detect_any. Tested language modes and offline hints are deployment validation data, not a closed product language list.
Include a placement diagnostic, a curriculum-configured lesson policy, concrete analogies, retrieval questions, misconception signals, evidence rules, and honest uncertainty behavior. Every placementDiagnostic.recommendations value must be the exact id of a concept in the generated concepts array, never advice prose.
For every concept, include at least one independently reviewed keypad transfer question with two to four short spoken choices, stable answer IDs, exactly one correct answer, and a featurePhoneSms under 100 characters. The SMS must explicitly list every choice using the rendered keypad numbers 1 through the choice count. Keypad items must use a novel case rather than repeat a placement or teaching example, test the reviewed objective without relying on visual notation, and must not by themselves establish secure mastery.
For every concept, include safe household anchor activities with generic object names, offline learner signals, one original response lead, and one question grounded in the reviewed learning objective. Anchor objectName values may contain only letters, combining marks, digits, spaces, apostrophes, and hyphens—never parentheses, commas, slashes, periods, contact details, or addresses. Do not require purchase, ingestion, heat, electricity, sharp tools, chemicals, or unsupervised risk.
For every concept, include at least one vocabulary bridge. Honor requiredVocabulary exactly when supplied. Each bridge must preserve a reviewed canonical term and its language, give a short voice-friendly definition, list informal learner expressions only as offline test signals, and provide original offline bridge copy. Vocabulary must help connect a learner's own words to curriculum language without treating English as universal.
For every concept that makes rational-number comparisons, include machine-checkable verifiedRationalComparisons matching the learner-facing claims. These are checked by application code, so never include a comparison unless its relation is mathematically true.
Include a child-safety policy with deployment-tested offline signals, prompt-injection resistance, benign off-topic redirects, and a graceful repeated-abuse ending. This offline signal list is a test adapter, not the live model's language boundary.
Return only the schema-valid draft. Provenance is attached by trusted application code after generation.`;

const VERIFIER_INSTRUCTIONS = `You independently verify a generated curriculum pack against its reviewed source brief.
Reject it if it exceeds source scope, copies or closely paraphrases source wording, contains inconsistent answers, omits or changes required vocabulary, lacks machine-checkable comparisons for numerical fraction claims, lacks a valid voice/DTMF transfer item per concept, composes into more than three sentences or multiple spoken questions, lacks voice-friendly Socratic scaffolds, embeds a closed language assumption, or invents unreviewed facts. For each sourceBrief.requiredVocabulary entry, generatedPack uses canonicalTerm, termLanguage, and spokenDefinition; spokenDefinition must equal the brief's meaning exactly. Those three approved exact-copy values are exempt from the originality comparison, and there is intentionally no separate meaning field in a vocabulary bridge. All surrounding teaching copy must remain original. A unique keypad question ID, answer key, short SMS, and novel transfer case make an item eligible for the later human release review; do not require an item-level approval field because the digest-bound release receipt records that review after this verifier pass.
Treat warnings as non-blocking only when they do not affect factual correctness, originality, safety, or schema completeness.
approved must be false whenever any error issue exists. Every issue must include conceptId; use null when the issue is not specific to one concept. Return only the verification result.`;

function safetyId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function removeUnsupportedPatterns(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) removeUnsupportedPatterns(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  Reflect.deleteProperty(record, "pattern");
  for (const child of Object.values(record)) removeUnsupportedPatterns(child);
}

export function curriculumDraftTextFormat() {
  const format = zodTextFormat(
    CurriculumPackDraftSchema,
    "curriculum_pack_draft",
  );
  // OpenAI Structured Outputs accepts only a JSON Schema subset. Zod emits
  // Unicode-property patterns for reviewed anchor phrases, which the API
  // rejects. Remove model-facing pattern keywords while preserving the SDK's
  // non-enumerable Zod parser; trusted code still parses the result with the
  // full CurriculumPackSchema below.
  removeUnsupportedPatterns(format.schema);
  return format;
}

export function assertRequiredVocabulary(
  brief: CurriculumSourceBrief,
  pack: CurriculumPack,
): void {
  for (const required of brief.requiredVocabulary) {
    const concept = pack.concepts.find(
      (candidate) => candidate.id === required.conceptId,
    );
    const bridge = concept?.vocabularyBridges.find(
      (candidate) =>
        candidate.canonicalTerm === required.canonicalTerm &&
        candidate.termLanguage === required.termLanguage &&
        candidate.spokenDefinition === required.meaning,
    );
    if (!bridge) {
      throw new Error(
        `Compiled pack is missing reviewed vocabulary ${required.canonicalTerm} for ${required.conceptId}.`,
      );
    }
  }
}

export function preserveReviewedVocabulary(
  brief: CurriculumSourceBrief,
  draft: CurriculumPackDraft,
): CurriculumPackDraft {
  const preserved = structuredClone(draft);
  for (const required of brief.requiredVocabulary) {
    const concept = preserved.concepts.find(
      (candidate) => candidate.id === required.conceptId,
    );
    const bridge = concept?.vocabularyBridges.find(
      (candidate) =>
        candidate.termLanguage === required.termLanguage &&
        candidate.canonicalTerm.trim().toLocaleLowerCase() ===
          required.canonicalTerm.trim().toLocaleLowerCase(),
    );
    if (!bridge) continue;
    bridge.canonicalTerm = required.canonicalTerm;
    bridge.termLanguage = required.termLanguage;
    bridge.spokenDefinition = required.meaning;
  }
  return preserved;
}

export function assertPackMatchesBrief(
  brief: CurriculumSourceBrief,
  pack: CurriculumPack,
): void {
  const expectedDeployment = brief.deployment;
  const actualDeployment = pack.deployment;
  for (const [field, expected, actual] of [
    ["country", expectedDeployment.country, actualDeployment.country],
    ["countryCode", expectedDeployment.countryCode, actualDeployment.countryCode],
    ["subject", expectedDeployment.subject, actualDeployment.subject],
    ["grade", expectedDeployment.grade, actualDeployment.grade],
    ["defaultLanguage", expectedDeployment.defaultLanguage, actualDeployment.defaultLanguage],
    ["syllabus", expectedDeployment.syllabus, actualDeployment.syllabus],
  ] as const) {
    if (actual !== expected) {
      throw new Error(
        `Compiled pack deployment ${field} must match the reviewed brief exactly.`,
      );
    }
  }
  if (
    JSON.stringify(actualDeployment.testedLanguageModes) !==
    JSON.stringify(expectedDeployment.testedLanguageModes)
  ) {
    throw new Error(
      "Compiled pack testedLanguageModes must match the reviewed brief exactly.",
    );
  }
  const expectedConcepts = [...brief.requiredConcepts].sort();
  const actualConcepts = pack.concepts.map((concept) => concept.id).sort();
  if (JSON.stringify(actualConcepts) !== JSON.stringify(expectedConcepts)) {
    throw new Error(
      "Compiled pack concept IDs must match the reviewed requiredConcepts exactly.",
    );
  }
  assertRequiredVocabulary(brief, pack);
}

export class OpenAICurriculumCompiler {
  readonly #client: OpenAI;
  readonly #compilerModel: string;
  readonly #verifierModel: string;

  constructor(options: {
    apiKey: string;
    compilerModel?: string;
    verifierModel?: string;
    client?: OpenAI;
  }) {
    this.#client = options.client ?? new OpenAI({ apiKey: options.apiKey });
    this.#compilerModel = options.compilerModel ?? "gpt-5.6-terra";
    this.#verifierModel = options.verifierModel ?? "gpt-5.6-terra";
  }

  async compile(
    unparsedBrief: CurriculumSourceBrief,
    trustedCorrectionIssues: string[] = [],
  ): Promise<CurriculumPack> {
    const brief = CurriculumSourceBriefSchema.parse(unparsedBrief);
    let pack: CurriculumPack | undefined;
    let correctionIssues = [...trustedCorrectionIssues];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await this.#client.responses.create({
        model: this.#compilerModel,
        instructions:
          attempt === 1 && correctionIssues.length === 0
            ? COMPILER_INSTRUCTIONS
            : `${COMPILER_INSTRUCTIONS}\nThis is correction attempt ${attempt}. Regenerate the complete draft and fix every trusted-validator issue supplied in the input.`,
        input: JSON.stringify({
          sourceBrief: brief,
          ...(correctionIssues.length > 0 ? { correctionIssues } : {}),
        }),
        text: {
          format: curriculumDraftTextFormat(),
        },
        reasoning: { effort: "high" },
        safety_identifier: safetyId(brief.id),
        store: false,
      });
      let draft: unknown;
      try {
        draft = JSON.parse(response.output_text) as unknown;
      } catch {
        correctionIssues = ["Return one complete JSON object matching the supplied schema."];
        continue;
      }
      const validation = CurriculumPackDraftSchema.safeParse(draft);
      if (!validation.success) {
        correctionIssues = validation.error.issues.map(
          (issue) => `${issue.path.join(".") || "draft"}: ${issue.message}`,
        );
        continue;
      }
      try {
        const preservedDraft = preserveReviewedVocabulary(brief, validation.data);
        pack = CurriculumPackSchema.parse({
          ...preservedDraft,
          provenance: {
            method: "compiled",
            sourceMaterials: brief.sourceMaterials.map(({ title, url }) => ({
              title,
              url,
            })),
            generatedByModel: this.#compilerModel,
            verifiedByModel: this.#verifierModel,
            humanReview: {
              reviewedBy: brief.review.reviewedBy,
              reviewedAt: brief.review.reviewedAt,
              scopeNotes: brief.review.scopeNotes,
            },
          },
        });
        assertPackMatchesBrief(brief, pack);
        break;
      } catch (error) {
        correctionIssues = [
          error instanceof Error ? error.message : "Trusted pack validation failed.",
        ];
        pack = undefined;
      }
    }
    if (!pack) {
      throw new Error(
        `OpenAI did not return a locally valid curriculum draft after three attempts: ${correctionIssues.join("; ")}`,
      );
    }
    return pack;
  }

  async verify(
    unparsedBrief: CurriculumSourceBrief,
    unparsedPack: CurriculumPack,
  ): Promise<CurriculumVerification> {
    const brief = CurriculumSourceBriefSchema.parse(unparsedBrief);
    const pack = CurriculumPackSchema.parse(unparsedPack);
    assertPackMatchesBrief(brief, pack);
    const response = await this.#client.responses.parse({
      model: this.#verifierModel,
      instructions: VERIFIER_INSTRUCTIONS,
      input: JSON.stringify({ sourceBrief: brief, generatedPack: pack }),
      text: {
        format: zodTextFormat(
          CurriculumVerificationSchema,
          "curriculum_verification",
        ),
      },
      reasoning: { effort: "high" },
      safety_identifier: safetyId(`${brief.id}:verify`),
      store: false,
    });
    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed curriculum verification.");
    }
    return CurriculumVerificationSchema.parse(response.output_parsed);
  }
}
