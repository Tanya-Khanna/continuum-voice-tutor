import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SAMPLE_SESSION,
  SampleSessionSchema,
} from "../src/samples/sample-session.js";

describe("sample session exhibit", () => {
  it("has ordered, non-overlapping transcript timings", () => {
    const sample = SampleSessionSchema.parse(SAMPLE_SESSION);
    for (const [index, segment] of sample.segments.entries()) {
      expect(segment.endMs).toBeGreaterThan(segment.startMs);
      const previous = sample.segments[index - 1];
      if (previous) expect(segment.startMs).toBeGreaterThan(previous.endMs);
    }
    expect(sample.languageModes).toContain("es+en");
    expect(sample.fixtureNotice).toContain("not a recording of a child");
  });

  it("ships the audio asset referenced by the manifest", () => {
    const path = "public/samples/sample-universal-code-switch.mp3";
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(10_000);
  });
});

