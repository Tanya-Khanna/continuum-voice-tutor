import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "../src/config/voice-language-menu.js";
import {
  buildVoiceLanguageMenuPrompt,
  languageOptionByKey,
  transcriptSelectsLanguage,
  VoiceLanguageMenuSchema,
} from "../src/language/voice-language-menu.js";

describe("voice language menu", () => {
  it("offers exactly nine unique keypad languages before onboarding", () => {
    const menu = VoiceLanguageMenuSchema.parse(DEFAULT_VOICE_LANGUAGE_MENU);
    expect(menu.map((option) => option.key)).toEqual([
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
    expect(menu.map((option) => option.languageMode)).toEqual([
      "en",
      "hi",
      "es",
      "fr",
      "sw",
      "ta",
      "bn",
      "ar",
      "ur",
    ]);

    const prompt = buildVoiceLanguageMenuPrompt(menu);
    expect(prompt).toContain("For English, press 1");
    expect(prompt).toContain("हिंदी के लिए 2 दबाएँ");
    expect(prompt).toContain("Para español, oprime 3");
    expect(prompt).toContain("Kwa Kiswahili, bonyeza tano, nambari 5");
    expect(prompt).toContain("اردو کے لیے 9 دبائیں");
  });

  it("matches explicit language words across scripts", () => {
    const spanish = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "3")!;

    expect(transcriptSelectsLanguage("Quiero español", spanish)).toBe(true);
  });

  it("never turns silence or unrelated speech into a language selection", () => {
    const english = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "1")!;
    for (const transcript of ["", "   ", "background noise", "Daniel"]) {
      expect(transcriptSelectsLanguage(transcript, english)).toBe(false);
    }
  });
});
