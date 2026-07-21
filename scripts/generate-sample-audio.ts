import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import OpenAI from "openai";
import { SAMPLE_AUDIO_SOURCE } from "../src/samples/sample-session.js";

const model = process.env.OPENAI_SPEECH_MODEL?.trim() || "tts-1-hd";
const backend = process.env.NOMAD_SAMPLE_AUDIO_BACKEND?.trim() || "openai";
const apiKey = process.env.OPENAI_API_KEY;
if (backend !== "system" && !apiKey) {
  throw new Error("OPENAI_API_KEY is required for the OpenAI backend.");
}
const outputPath = resolve(
  "public/samples/sample-universal-code-switch.mp3",
);
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "continuum-sample-audio-"),
);
const gapSeconds = 0.45;
const client = new OpenAI({ apiKey: apiKey ?? "unused-system-backend" });

try {
  const segmentPaths: string[] = [];
  for (const [index, segment] of SAMPLE_AUDIO_SOURCE.entries()) {
    const segmentPath = join(
      temporaryDirectory,
      `segment-${index}.${backend === "system" ? "aiff" : "wav"}`,
    );
    if (backend === "system") {
      execFileSync(
        "say",
        [
          "-v",
          segment.systemVoice,
          "-r",
          segment.speaker === "continuum" ? "158" : "170",
          "-o",
          segmentPath,
          segment.text,
        ],
        { stdio: "inherit" },
      );
    } else {
      const speech = await client.audio.speech.create({
        model,
        voice: segment.openaiVoice,
        input: segment.text,
        response_format: "wav",
        speed: segment.speaker === "continuum" ? 0.92 : 1,
      });
      writeFileSync(segmentPath, Buffer.from(await speech.arrayBuffer()));
    }
    segmentPaths.push(segmentPath);
  }

  mkdirSync(resolve("public/samples"), { recursive: true });
  const inputs = segmentPaths.flatMap((path) => ["-i", path]);
  const normalized = segmentPaths
    .map(
      (_, index) =>
        `[${index}:a]aresample=24000,aformat=sample_fmts=s16:channel_layouts=mono[a${index}]`,
    )
    .join(";");
  const silences = segmentPaths
    .slice(1)
    .map(
      (_, index) =>
        `anullsrc=r=24000:cl=mono:d=${gapSeconds.toFixed(2)}[s${index}]`,
    )
    .join(";");
  const sequence = segmentPaths
    .flatMap((_, index) =>
      index === segmentPaths.length - 1 ? [`[a${index}]`] : [`[a${index}]`, `[s${index}]`],
    )
    .join("");
  const filter = `${normalized};${silences};${sequence}concat=n=${segmentPaths.length * 2 - 1}:v=0:a=1[out]`;

  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      outputPath,
    ],
    { stdio: "inherit" },
  );

  let cursorMs = 0;
  const timings = segmentPaths.map((path, index) => {
    const durationSeconds = Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          path,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    const startMs = cursorMs;
    const endMs = startMs + Math.round(durationSeconds * 1_000);
    cursorMs = endMs + (index === segmentPaths.length - 1 ? 0 : gapSeconds * 1_000);
    return { startMs, endMs };
  });
  console.log(
    JSON.stringify(
      {
        backend,
        model: backend === "system" ? "macOS system speech / es-MX" : model,
        outputPath,
        timings,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
