import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CurriculumPackDraftSchema,
  CurriculumPackSchema,
  type CurriculumPack,
} from "../curriculum/schema.js";
import {
  CurriculumSourceBriefSchema,
  CurriculumVerificationSchema,
  type CurriculumSourceBrief,
  type CurriculumVerification,
} from "./schema.js";

const COMPILER_INSTRUCTIONS = `You compile a frozen voice-first Socratic curriculum pack from a reviewed source brief.
Use source themes only to determine scope and learning objectives. Write all questions, explanations, analogies, misconceptions, examples, and wording originally; never reproduce source prose.
Stay within the stated grade, subject, required concepts, and source themes. Never add facts that cannot be supported by the brief.
Make every learner-facing string short and natural aloud, with one question at a time and no Markdown or unexplained symbolic notation.
Keep language detection universal: languagePolicy must be model_detect_any. Tested language modes and offline hints are deployment validation data, not a closed product language list.
Include a placement diagnostic, a curriculum-configured lesson policy, concrete analogies, retrieval questions, misconception signals, evidence rules, and honest uncertainty behavior.
Include a child-safety policy with deployment-tested offline signals, prompt-injection resistance, benign off-topic redirects, and a graceful repeated-abuse ending. This offline signal list is a test adapter, not the live model's language boundary.
Return only the schema-valid draft. Provenance is attached by trusted application code after generation.`;

const VERIFIER_INSTRUCTIONS = `You independently verify a generated curriculum pack against its reviewed source brief.
Reject it if it exceeds source scope, copies or closely paraphrases source wording, contains inconsistent answers, lacks voice-friendly Socratic scaffolds, embeds a closed language assumption, or invents unreviewed facts.
Treat warnings as non-blocking only when they do not affect factual correctness, originality, safety, or schema completeness.
approved must be false whenever any error issue exists. Return only the verification result.`;

function safetyId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

  async compile(unparsedBrief: CurriculumSourceBrief): Promise<CurriculumPack> {
    const brief = CurriculumSourceBriefSchema.parse(unparsedBrief);
    const response = await this.#client.responses.parse({
      model: this.#compilerModel,
      instructions: COMPILER_INSTRUCTIONS,
      input: JSON.stringify(brief),
      text: {
        format: zodTextFormat(CurriculumPackDraftSchema, "curriculum_pack_draft"),
      },
      reasoning: { effort: "high" },
      safety_identifier: safetyId(brief.id),
      store: false,
    });
    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed curriculum draft.");
    }
    return CurriculumPackSchema.parse({
      ...response.output_parsed,
      provenance: {
        method: "compiled",
        sourceMaterials: brief.sourceMaterials.map(({ title, url }) => ({
          title,
          url,
        })),
        generatedByModel: this.#compilerModel,
        verifiedByModel: this.#verifierModel,
      },
    });
  }

  async verify(
    unparsedBrief: CurriculumSourceBrief,
    unparsedPack: CurriculumPack,
  ): Promise<CurriculumVerification> {
    const brief = CurriculumSourceBriefSchema.parse(unparsedBrief);
    const pack = CurriculumPackSchema.parse(unparsedPack);
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
