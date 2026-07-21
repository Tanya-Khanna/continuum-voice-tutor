import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_LANGUAGE_MENU } from "../src/config/voice-language-menu.js";
import {
  buildVoiceLanguageMenuPrompt,
  languageOptionByKey,
  transcriptSelectsDuration,
  transcriptSelectsLanguage,
  transcriptSelectsSubject,
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
    expect(prompt).toContain("Kwa Kiswahili, bonyeza 5");
    expect(prompt).toContain("اردو کے لیے 9 دبائیں");
  });

  it("matches explicit language, subject, and duration words across scripts", () => {
    const spanish = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "3")!;
    const hindi = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "2")!;
    const swahili = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "5")!;

    expect(transcriptSelectsLanguage("Quiero español", spanish)).toBe(true);
    expect(
      transcriptSelectsSubject({
        transcript: "Quiero estudiar ciencias",
        subject: "Science",
        languageOption: spanish,
      }),
    ).toBe(true);
    expect(
      transcriptSelectsSubject({
        transcript: "मुझे विज्ञान पढ़ना है",
        subject: "Science",
        languageOption: hindi,
      }),
    ).toBe(true);
    expect(
      transcriptSelectsSubject({
        transcript: "Nataka sayansi",
        subject: "Science",
        languageOption: swahili,
      }),
    ).toBe(true);
    expect(
      transcriptSelectsDuration({
        transcript: "cinco minutos",
        duration: 5,
        languageOption: spanish,
      }),
    ).toBe(true);
  });

  it("never turns silence or unrelated speech into a subject selection", () => {
    const english = languageOptionByKey(DEFAULT_VOICE_LANGUAGE_MENU, "1")!;
    for (const transcript of ["", "   ", "background noise", "Daniel"]) {
      expect(
        transcriptSelectsSubject({
          transcript,
          subject: "Science",
          languageOption: english,
        }),
      ).toBe(false);
    }
  });
});
