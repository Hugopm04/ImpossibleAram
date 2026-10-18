// Precomputed leaderboards re-weighted live (D52): stored builds keep their axes and power, so a
// G/C/F weight change re-scores them exactly. The expected value is a single number, so it is
// rescaled by the champion's ceiling ratio (approximation).
import type { Leaderboard, LeaderboardBuild, Settings } from "./types";
import { crazinessOf } from "./score";

export interface ScoredBuild extends LeaderboardBuild {
  champion: string;
  score: number; // re-weighted craziness
}

export interface ChampionScore {
  id: string;
  ceiling: number; // re-weighted craziness of the best build
  expected: number;
  best: ScoredBuild;
}

export function rescore(settings: Settings, champion: string, b: LeaderboardBuild): ScoredBuild {
  return { ...b, champion, score: crazinessOf(settings, b.power, b.axes) };
}

/** Per champion: the best build under the current weights (among the stored ones) and the expected value. */
export function championScores(lb: Leaderboard | null, settings: Settings): Map<string, ChampionScore> {
  const out = new Map<string, ChampionScore>();
  for (const c of lb?.champions ?? []) {
    if (!c.best) continue;
    const builds = buildsOf(c).map((b) => rescore(settings, c.id, b));
    const best = builds.reduce((x, y) => (y.score > x.score ? y : x));
    const ratio = c.best.craziness > 0 ? crazinessOf(settings, c.best.power, c.best.axes) / c.best.craziness : 1;
    out.set(c.id, { id: c.id, ceiling: best.score, expected: c.expected * ratio, best });
  }
  return out;
}

/** Every stored build of every champion (top builds + the most-G/C/F ones), duplicates removed. */
export function comboRows(lb: Leaderboard | null, settings: Settings): ScoredBuild[] {
  const rows: ScoredBuild[] = [];
  for (const c of lb?.champions ?? []) for (const b of buildsOf(c)) rows.push(rescore(settings, c.id, b));
  return rows;
}

function buildsOf(c: Leaderboard["champions"][number]): LeaderboardBuild[] {
  const seen = new Set<string>();
  const out: LeaderboardBuild[] = [];
  const all = [...(c.top?.length ? c.top : [c.best]), c.axisBest?.g, c.axisBest?.c, c.axisBest?.f];
  for (const b of all) {
    if (!b) continue;
    const key = b.picks.map((p) => `${p.aug}:${p.slot ?? ""}`).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}
