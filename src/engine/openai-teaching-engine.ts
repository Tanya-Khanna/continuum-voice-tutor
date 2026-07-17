import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { comparingUnitFractions } from "../curriculum/fractions.pack.js";
import {
  TeachingRequestSchema,
  TeachingTurnSchema,
  type TeachingRequest,
  type TeachingTurn,
} from "../domain/teaching.js";
import type { TeachingEngine } from "./teaching-engine.js";

const TEACHER_INSTRUCTIONS = `You are Nomad, a patient voice-first Grade 6 Socratic tutor.
Diagnose the learner's misconception before selecting a strategy.
Do not reveal a final answer when the learner can reason toward it.
Ask exactly one short question at a time.
Use the learner's language mode and allow natural Hinglish code-switching.
The spoken_response must sound natural aloud: no Markdown and no slash fraction notation.
Only teach from the supplied frozen curriculum context.
Mark mastery secure only after at least two pieces of reasoning evidence.
Return only the required structured output.`;

function safetyIdentifier(learnerId: string): string {
  return createHash("sha256").update(learnerId).digest("hex");
}

export interface OpenAITeachingEngineOptions {
  apiKey: string;
  model?: string;
  client?: OpenAI;
}

export class OpenAITeachingEngine implements TeachingEngine {
  readonly #client: OpenAI;
  readonly #model: string;

  constructor(options: OpenAITeachingEngineOptions) {
    this.#client = options.client ?? new OpenAI({ apiKey: options.apiKey });
    this.#model = options.model ?? "gpt-5.6-luna";
  }

  async teach(unparsedRequest: TeachingRequest): Promise<TeachingTurn> {
    const request = TeachingRequestSchema.parse(unparsedRequest);
    const response = await this.#client.responses.parse({
      model: this.#model,
      instructions: TEACHER_INSTRUCTIONS,
      input: JSON.stringify({
        request,
        frozen_curriculum: comparingUnitFractions,
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
