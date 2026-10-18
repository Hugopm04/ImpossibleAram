// Ranking candidates given the current build (D7, D46):
//   now       = craziness of the build with the candidate added
//   best case = optimal play + best luck: the best follow-ups on every remaining screen
//   expected  = optimal play with real odds: for each remaining screen, the expected best card
//               among the ~6 seen (3 cards + rerolls) of each possible rarity
// For speed, follow-up gains are measured once against the current build and adjusted with
// the pairwise synergy between the candidate and each follow-up (exact for synergy, an
// approximation for everything else). The top results can be re-evaluated exactly.

import type { Augment, Build, Pick, Rarity, Slot } from "./types";
import {
  augmentElement, bestSlot, evaluate, pairSynergy, weightedSum, type Ctx, type Element, type Evaluation,
} from "./score";
import {
  RARITIES, SEEN_WITH_REROLLS, completionProbability, eligibleAt, excludedByBuild, futureRarityDist, nextStage,
  offerProbability, offerProbabilityAnyRemaining, type OddsCtx,
} from "./odds";
import { choose } from "./anvils";

export interface Candidate {
  aug: Augment;
  slot?: Slot;
  stage: number;
  now: number;
  nowEval: Evaluation;
  best: number;
  bestPath: Pick[];
  bestProbability: number;
  expected: number;
  pNext: number;
  pAny: number;
  gain: number;
}

function remainingStages(build: Build): number[] {
  const used = new Set(build.picks.map((p) => p.stage));
  const out: number[] = [];
  for (let s = nextStage(build); s <= 4; s++) if (!used.has(s)) out.push(s);
  return out;
}

export function oddsCtx(ctx: Ctx): OddsCtx {
  return { data: ctx.data, champ: ctx.champ, stats: ctx.stats, settings: ctx.settings };
}

/** All augments obtainable on some remaining screen. */
export function candidatesFor(ctx: Ctx, build: Build, stages = remainingStages(build)): Augment[] {
  const o = oddsCtx(ctx);
  return ctx.data.augments.filter((a) => !excludedByBuild(o, a, build) && stages.some((s) => eligibleAt(o, a, s)));
}

function withPick(build: Build, aug: Augment, stage: number, slot?: Slot): Build {
  return { ...build, picks: [...build.picks, { aug: aug.id, stage, slot }] };
}

/** Expected best gain when ~6 distinct cards are seen out of a pool with the given gains. */
function expectedBestSeen(gains: number[], seen = SEEN_WITH_REROLLS): number {
  const g = gains.filter((x) => x > 0).sort((a, b) => b - a);
  const n = gains.length;
  if (!n || !g.length) return 0;
  if (n <= seen) return g[0];
  const denom = choose(n, seen);
  let total = 0;
  for (let j = 0; j < g.length; j++) total += g[j] * choose(n - j - 1, seen - 1) / denom;
  return total;
}

export interface RankOptions {
  items: string[];
  stage?: number; // screen the candidate would be taken on (default: next)
  limit?: number;
}

export function rankCandidates(ctx: Ctx, build: Build, opts: RankOptions): Candidate[] {
  const o = oddsCtx(ctx);
  const stages = remainingStages(build);
  if (!stages.length) return [];
  const stage = opts.stage ?? stages[0];
  const later = stages.filter((s) => s > stage);
  const base = evaluate(ctx, build, opts.items).craziness;
  const pool = candidatesFor(ctx, build, stages);

  // follow-up gains against the current build, per augment (best slot)
  const follow = new Map<string, { aug: Augment; gain: number; el: Element; slot?: Slot }>();
  for (const b of pool) {
    const slot = b.isAbility ? bestSlot(ctx.champ, b) : undefined;
    const st = later.find((s) => eligibleAt(o, b, s)) ?? stage;
    const ev = evaluate(ctx, withPick(build, b, st, slot), opts.items).craziness;
    const el = augmentElement(ctx, { aug: b.id, stage: st, slot })!;
    follow.set(b.id, { aug: b, gain: ev - base, el, slot });
  }
  const weight = (ax: { g: number; c: number; f: number }) => weightedSum(ctx.settings, ax);

  const out: Candidate[] = [];
  for (const a of pool) {
    if (!eligibleAt(o, a, stage)) continue;
    const slot = a.isAbility ? bestSlot(ctx.champ, a) : undefined;
    const nb = withPick(build, a, stage, slot);
    const nowEval = evaluate(ctx, nb, opts.items);
    const elA = augmentElement(ctx, { aug: a.id, stage, slot })!;
    const powerNow = nowEval.power;

    // adjusted follow-up gains given candidate a
    const adj = new Map<string, number>();
    for (const [id, f] of follow) {
      if (id === a.id) continue;
      adj.set(id, f.gain + powerNow * weight(pairSynergy(ctx, elA, f.el)));
    }

    // best case: greedy best follow-ups on later screens (best luck: the card is always offered)
    let best = nowEval.craziness;
    const path: Pick[] = [];
    const taken = new Set([a.id]);
    let prevRarity: Rarity = a.rarity;
    for (const s of later) {
      let pickId: string | null = null;
      let pickGain = 0;
      for (const [id, g] of adj) {
        if (taken.has(id)) continue;
        const f = follow.get(id)!;
        if (!eligibleAt(o, f.aug, s)) continue;
        if (s === 2 && prevRarity === "silver" && f.aug.rarity === "silver") continue; // screens 1-2 can't both be Silver
        let extra = g;
        for (const p of path) extra += powerNow * weight(pairSynergy(ctx, follow.get(p.aug)!.el, f.el));
        if (extra > pickGain) { pickGain = extra; pickId = id; }
      }
      if (!pickId) break;
      taken.add(pickId);
      const f = follow.get(pickId)!;
      path.push({ aug: pickId, stage: s, slot: f.slot });
      prevRarity = f.aug.rarity;
      best += pickGain;
    }

    // expected: per later screen, expected best seen card of each rarity
    let expected = nowEval.craziness;
    let lastStage = stage;
    for (const s of later) {
      const dist = futureRarityDist(ctx.data, s, lastStage, a.rarity);
      for (const r of RARITIES) {
        if (!dist[r]) continue;
        const gains: number[] = [];
        for (const [id, g] of adj) {
          const f = follow.get(id)!;
          if (f.aug.rarity === r && eligibleAt(o, f.aug, s)) gains.push(g);
        }
        expected += dist[r] * expectedBestSeen(gains) * 0.85; // 0.85: follow-ups compete for the same screens
      }
      lastStage = s;
    }

    out.push({
      aug: a, slot, stage, now: nowEval.craziness, nowEval, best, bestPath: path,
      bestProbability: 0, expected,
      pNext: offerProbability(o, build, a, stage, slot),
      pAny: offerProbabilityAnyRemaining(o, build, a),
      gain: nowEval.craziness - base,
    });
  }
  const key = ctx.settings.sortBy;
  out.sort((x, y) => sortValue(y, key) - sortValue(x, key));
  const limit = opts.limit ?? out.length;
  // probability of the best case (candidate + its follow-ups) for the shown rows
  for (const c of out.slice(0, Math.min(limit, 60))) {
    c.bestProbability = completionProbability(o, build, [{ aug: c.aug.id, slot: c.slot }, ...c.bestPath.map((p) => ({ aug: p.aug, slot: p.slot }))]);
  }
  return out.slice(0, limit);
}

export function sortValue(c: Candidate, key: string): number {
  switch (key) {
    case "expected": return c.expected;
    case "now": return c.now;
    case "probability": return c.pNext;
    default: return c.best;
  }
}

/** Full beam search for the craziest complete builds of a champion (leaderboards, ceilings). */
export function beamSearch(ctx: Ctx, items: (b: Build) => string[], width = 10, start?: Build):
  { build: Build; eval: Evaluation }[] {
  const o = oddsCtx(ctx);
  let beam: Build[] = [start ?? { champion: ctx.champ.id, picks: [], anvils: [], lockedItems: [] }];
  const stages = remainingStages(beam[0]);
  const cache = new Map<string, number>();
  const keyOf = (b: Build) => b.picks.map((p) => `${p.aug}:${p.slot ?? ""}`).sort().join("|");
  for (const s of stages) {
    const next: { b: Build; v: number }[] = [];
    for (const b of beam) {
      const prev = b.picks.find((p) => p.stage === s - 1);
      const prevRarity = prev ? ctx.data.augmentById.get(prev.aug)?.rarity : undefined;
      for (const a of ctx.data.augments) {
        if (!eligibleAt(o, a, s) || excludedByBuild(o, a, b)) continue;
        if (s === 2 && prevRarity === "silver" && a.rarity === "silver") continue;
        const slot = a.isAbility ? bestSlot(ctx.champ, a) : undefined;
        const nb = withPick(b, a, s, slot);
        const k = keyOf(nb);
        if (cache.has(k)) continue;
        const v = evaluate(ctx, nb, items(nb)).craziness;
        cache.set(k, v);
        next.push({ b: nb, v });
      }
    }
    next.sort((x, y) => y.v - x.v);
    beam = next.slice(0, width).map((x) => x.b);
    if (!beam.length) break;
  }
  return beam.map((b) => ({ build: b, eval: evaluate(ctx, b, items(b), true) }));
}
