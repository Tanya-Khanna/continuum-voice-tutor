const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/giu;
const LONG_NUMBER_PATTERN = /(?<!\w)(?:\+?\d[\d ()-]{5,}\d)(?!\w)/gu;
const ADDRESS_PATTERN =
  /\b(?:my address is|i live at|send it to)\s+[^.!?]{3,120}/giu;

export function redactPotentialPii(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[email redacted]")
    .replace(URL_PATTERN, "[link redacted]")
    .replace(ADDRESS_PATTERN, "[address redacted]")
    .replace(LONG_NUMBER_PATTERN, "[number redacted]");
}
