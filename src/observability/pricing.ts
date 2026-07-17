import type { StoredModelUsage } from "../domain/usage.js";

interface ModelRates {
  asOf: string;
  sourceUrl: string;
  inputText: number;
  cachedInputText: number;
  outputText: number;
  inputAudio?: number;
  cachedInputAudio?: number;
  outputAudio?: number;
}

const PER_MILLION = 1_000_000;

export const MODEL_RATES: Readonly<Record<string, ModelRates>> = {
  "gpt-5.6-luna": {
    asOf: "2026-07-17",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
    inputText: 1,
    cachedInputText: 0.1,
    outputText: 6,
  },
  "gpt-realtime-2.1-mini": {
    asOf: "2026-07-17",
    sourceUrl:
      "https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini",
    inputText: 0.6,
    cachedInputText: 0.06,
    outputText: 2.4,
    inputAudio: 10,
    cachedInputAudio: 0.3,
    outputAudio: 20,
  },
};

export interface UsageCostEstimate {
  usd: number | null;
  asOf?: string;
  sourceUrl?: string;
}

export function estimateUsageCost(
  usage: StoredModelUsage,
): UsageCostEstimate {
  const rates = MODEL_RATES[usage.modelRoute];
  if (!rates) return { usd: null };
  if (
    (usage.inputAudioTokens > 0 && rates.inputAudio === undefined) ||
    (usage.cachedInputAudioTokens > 0 &&
      rates.cachedInputAudio === undefined) ||
    (usage.outputAudioTokens > 0 && rates.outputAudio === undefined)
  ) {
    return { usd: null, asOf: rates.asOf, sourceUrl: rates.sourceUrl };
  }

  const uncachedText = Math.max(
    0,
    usage.inputTextTokens - usage.cachedInputTextTokens,
  );
  const uncachedAudio = Math.max(
    0,
    usage.inputAudioTokens - usage.cachedInputAudioTokens,
  );
  const usd =
    (uncachedText * rates.inputText +
      usage.cachedInputTextTokens * rates.cachedInputText +
      usage.outputTextTokens * rates.outputText +
      uncachedAudio * (rates.inputAudio ?? 0) +
      usage.cachedInputAudioTokens * (rates.cachedInputAudio ?? 0) +
      usage.outputAudioTokens * (rates.outputAudio ?? 0)) /
    PER_MILLION;

  return { usd, asOf: rates.asOf, sourceUrl: rates.sourceUrl };
}

