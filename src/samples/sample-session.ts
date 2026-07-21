import { z } from "zod";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";

export const SampleSessionSegmentSchema = z.object({
  speaker: z.enum(["learner", "continuum"]),
  text: z.string().min(1),
  languageMode: ResolvedLanguageModeSchema,
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});

export const SampleSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  fixtureNotice: z.string().min(1),
  languageModes: z.array(ResolvedLanguageModeSchema).min(1),
  audioUrl: z.string().startsWith("/"),
  audioModel: z.string().min(1),
  generatedAt: z.string().datetime(),
  segments: z.array(SampleSessionSegmentSchema).min(1),
});

export const SAMPLE_AUDIO_SOURCE = [
  {
    speaker: "learner" as const,
    openaiVoice: "cedar",
    systemVoice: "Eddy (Spanish (Mexico))",
    languageMode: "es+en",
    text: "Creo que one fourth is bigger, porque four is bigger than three.",
  },
  {
    speaker: "continuum" as const,
    openaiVoice: "marin",
    systemVoice: "Flo (Spanish (Mexico))",
    languageMode: "es+en",
    text: "Buena idea para probar. Imagine two same-sized flatbreads: una se divide entre tres personas y otra entre cuatro. ¿Quién recibe el pedazo más grande, y por qué?",
  },
  {
    speaker: "learner" as const,
    openaiVoice: "cedar",
    systemVoice: "Eddy (Spanish (Mexico))",
    languageMode: "es+en",
    text: "La persona in the group of three, porque hay fewer pieces, so each piece is bigger.",
  },
  {
    speaker: "continuum" as const,
    openaiVoice: "marin",
    systemVoice: "Flo (Spanish (Mexico))",
    languageMode: "es+en",
    text: "Exactamente. More equal pieces make each piece smaller. Ahora compara one fifth and one eighth. ¿Cuál es mayor, y qué regla estás usando?",
  },
] as const;

export const SAMPLE_SESSION = SampleSessionSchema.parse({
  id: "universal-code-switch-01",
  title: "One idea, two languages",
  description:
    "A Spanish-English transfer example showing that language tags and code-switching are not limited to one deployment pair.",
  fixtureNotice:
    "Curated demonstration fixture with local synthetic voices; not a recording of a child or a live call.",
  languageModes: ["es+en"],
  audioUrl: "/assets/sample-universal-code-switch.mp3",
  audioModel: "macOS system speech / es-MX",
  generatedAt: "2026-07-17T05:40:00.000Z",
  segments: SAMPLE_AUDIO_SOURCE.map((segment, index) => {
    const timing = [
      { startMs: 0, endMs: 3_945 },
      { startMs: 4_395, endMs: 16_265 },
      { startMs: 16_715, endMs: 21_961 },
      { startMs: 22_411, endMs: 32_650 },
    ][index]!;
    return {
      speaker: segment.speaker,
      text: segment.text,
      languageMode: segment.languageMode,
      ...timing,
    };
  }),
});
