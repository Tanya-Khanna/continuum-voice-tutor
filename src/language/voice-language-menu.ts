import { z } from "zod";
import { ResolvedLanguageModeSchema } from "../domain/teaching.js";

const KeypadLanguageKeySchema = z.enum([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

export const VoiceLanguageOptionSchema = z.object({
  key: KeypadLanguageKeySchema,
  languageMode: ResolvedLanguageModeSchema,
  displayName: z.string().trim().min(1).max(80),
  selectionPrompt: z.string().trim().min(1).max(240),
  identityPrompt: z.string().trim().min(1).max(240),
  languageAliases: z.array(z.string().trim().min(1).max(80)).min(1),
  subjectAliases: z.record(
    z.string().trim().min(1).max(80),
    z.array(z.string().trim().min(1).max(80)).min(1),
  ),
  curiosityAliases: z.array(z.string().trim().min(1).max(80)).min(1),
  durationAliases: z.object({
    3: z.array(z.string().trim().min(1).max(40)).min(1),
    5: z.array(z.string().trim().min(1).max(40)).min(1),
    10: z.array(z.string().trim().min(1).max(40)).min(1),
  }),
});

export const VoiceLanguageMenuSchema = z
  .array(VoiceLanguageOptionSchema)
  .length(9)
  .superRefine((options, context) => {
    const keys = new Set(options.map((option) => option.key));
    const modes = new Set(options.map((option) => option.languageMode));
    if (keys.size !== options.length) {
      context.addIssue({
        code: "custom",
        message: "Voice-language keypad keys must be unique.",
      });
    }
    if (modes.size !== options.length) {
      context.addIssue({
        code: "custom",
        message: "Voice-language modes must be unique.",
      });
    }
  });

export type VoiceLanguageOption = z.infer<typeof VoiceLanguageOptionSchema>;
export type VoiceLanguageMenu = z.infer<typeof VoiceLanguageMenuSchema>;

function normalizeSpokenChoice(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function includesAlias(transcript: string, aliases: readonly string[]): boolean {
  const normalizedTranscript = normalizeSpokenChoice(transcript);
  if (!normalizedTranscript) return false;
  return aliases.some((alias) => {
    const normalizedAlias = normalizeSpokenChoice(alias);
    return (
      normalizedAlias.length > 0 &&
      (normalizedTranscript === normalizedAlias ||
        normalizedTranscript
          .split(" ")
          .some((_, index, words) =>
            words.slice(index, index + normalizedAlias.split(" ").length).join(" ") ===
            normalizedAlias,
          ))
    );
  });
}

export function buildVoiceLanguageMenuPrompt(menu: VoiceLanguageMenu): string {
  const parsed = VoiceLanguageMenuSchema.parse(menu);
  return `Choose your language using the keypad. ${parsed
    .map((option) => option.selectionPrompt)
    .join(" ")} If your language is not listed, press star and say its name.`;
}

export function languageOptionByKey(
  menu: VoiceLanguageMenu,
  key: string,
): VoiceLanguageOption | undefined {
  return menu.find((option) => option.key === key);
}

export function languageOptionByMode(
  menu: VoiceLanguageMenu,
  languageMode: string,
): VoiceLanguageOption | undefined {
  return menu.find((option) => option.languageMode === languageMode);
}

export function transcriptSelectsLanguage(
  transcript: string,
  option: VoiceLanguageOption,
): boolean {
  return includesAlias(transcript, option.languageAliases);
}

export function transcriptSelectsSubject(options: {
  transcript: string;
  subject: string;
  languageOption?: VoiceLanguageOption;
}): boolean {
  const aliases = options.languageOption?.subjectAliases[options.subject] ?? [
    options.subject,
  ];
  return includesAlias(options.transcript, [options.subject, ...aliases]);
}

export function transcriptSelectsCuriosity(
  transcript: string,
  languageOption?: VoiceLanguageOption,
): boolean {
  return includesAlias(
    transcript,
    languageOption?.curiosityAliases ?? [
      "curious sandbox",
      "ask anything",
      "curious",
    ],
  );
}

export function transcriptSelectsDuration(options: {
  transcript: string;
  duration: 3 | 5 | 10;
  languageOption?: VoiceLanguageOption;
}): boolean {
  const aliases = options.languageOption?.durationAliases[options.duration] ?? [
    String(options.duration),
  ];
  return includesAlias(options.transcript, [String(options.duration), ...aliases]);
}

export function hasMeaningfulTranscript(transcript: string): boolean {
  return /[\p{L}\p{N}]/u.test(transcript);
}
