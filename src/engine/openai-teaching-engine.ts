import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { CurriculumPack } from "../curriculum/schema.js";
import {
  TeachingRequestSchema,
  TeachingTurnSchema,
  type TeachingRequest,
  type TeachingTurn,
} from "../domain/teaching.js";
import type { TeachingEngine } from "./teaching-engine.js";

const TEACHER_INSTRUCTIONS = `You are Nomad, a patient voice-first Socratic tutor.
Diagnose the learner's misconception before selecting a strategy.
Do not reveal a final answer when the learner can reason toward it.
Ask exactly one short question at a time.
Evaluate the learner's meaning, not isolated keywords. If they give the correct conclusion with valid reasoning that matches an evidence rule, mark them developing and choose retrieval_practice with a genuinely new transfer example. Do not reteach or ask them to repeat the example they just solved.
Use concrete_analogy only when the learner shows a misconception or needs conceptual support. Use ask_reasoning when a conclusion lacks reasoning, smaller_step for silence or confusion, retrieval_practice for supported understanding, and recap only in the recap phase.
Detect and respond in whatever language or language combination the learner uses. Never assume a country implies a language.
Represent detected languages with BCP-47-style tags joined by plus signs when the learner code-switches.
The spoken_response must sound natural aloud: no Markdown, and read symbolic notation naturally as spoken words.
Only teach from the supplied frozen curriculum context.
Mark mastery secure only after at least two pieces of reasoning evidence.
Use lessonState when supplied. During explore, diagnose and guide. During check, ask for independent reasoning. During recap, briefly summarize progress in the learner's current language, invite them to call again, set should_end_session true, and store a retrieval question in next_question without speaking that question now.
Set should_end_session false outside the recap phase.
Return only the required structured output.`;

function safetyIdentifier(learnerId: string): string {
  return createHash("sha256").update(learnerId).digest("hex");
}

export interface OpenAITeachingEngineOptions {
  apiKey: string;
  model?: string;
  client?: OpenAI;
  curriculumPack: CurriculumPack;
}

export class OpenAITeachingEngine implements TeachingEngine {
  readonly #client: OpenAI;
  readonly #model: string;
  readonly #curriculumPack: CurriculumPack;

  get modelRoute(): string {
    return this.#model;
  }

  constructor(options: OpenAITeachingEngineOptions) {
    this.#client = options.client ?? new OpenAI({ apiKey: options.apiKey });
    this.#model = options.model ?? "gpt-5.6-luna";
    this.#curriculumPack = options.curriculumPack;
  }

  async teach(unparsedRequest: TeachingRequest): Promise<TeachingTurn> {
    const request = TeachingRequestSchema.parse(unparsedRequest);
    const concept = this.#curriculumPack.concepts.find(
      (candidate) => candidate.id === request.concept,
    );
    if (!concept) {
      throw new Error(
        `Concept ${request.concept} is not present in curriculum pack ${this.#curriculumPack.id}.`,
      );
    }
    const response = await this.#client.responses.parse({
      model: this.#model,
      instructions: TEACHER_INSTRUCTIONS,
      input: JSON.stringify({
        request,
        deployment: this.#curriculumPack.deployment,
        frozen_curriculum: concept,
      }),
      text: {
        format: zodTextFormat(TeachingTurnSchema, "teaching_turn"),
      },
      reasoning: { effort: "low" },
      safety_identifier: safetyIdentifier(request.learnerId),
      store: false,
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed teaching turn.");
    }

    return TeachingTurnSchema.parse(response.output_parsed);
  }
}
