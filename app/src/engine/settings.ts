import type { FeedbackEntry, Settings } from "./types";

// D32 default weights, D36 a/b defaults, D37 milestone default.
export const DEFAULT_SETTINGS: Settings = {
  weights: { g: 40, c: 35, f: 25 },
  a: 1,
  b: 0.5,
  milestone: 0,
  locale: "en",
  sortBy: "best",
};

export interface Tuning {
  weights?: Settings["weights"];
  a?: number;
  b?: number;
  history?: { date: string; before: Settings["weights"]; after: Settings["weights"]; reason: string }[];
}

/**
 * Auto-tune (D8a): small weight adjustments from per-axis ratings. If the player rates an axis
 * higher than the model scored it, that axis gains weight (and vice versa). Weights stay within
 * [10, 70] and are renormalised to sum to 100.
 */
export function autoTune(settings: Settings, fb: FeedbackEntry, axisScores: { g: number; c: number; f: number }): Settings["weights"] {
  const eta = 0.6;
  const w = { ...settings.weights };
  const axes: ("g" | "c" | "f")[] = ["g", "c", "f"];
  for (const k of axes) {
    const rated = fb.axes?.[k];
    if (rated == null) continue;
    const modelled = Math.max(0, Math.min(10, axisScores[k]));
    w[k] = Math.max(10, Math.min(70, w[k] + eta * (rated - modelled)));
  }
  const tot = w.g + w.c + w.f;
  return { g: round1((w.g / tot) * 100), c: round1((w.c / tot) * 100), f: round1((w.f / tot) * 100) };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
