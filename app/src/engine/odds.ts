// Probabilities (D18, D23): rarity per screen, offer odds, build probabilities.
//
// Sources and assumptions (all flagged as estimates in the UI):
//  - Rarity per screen and screen→screen transitions: ARAMKit (patch data, ~36M games).
//  - Eligible pool per champion and screen: observed data (D48).
//  - Within the eligible pool, cards are drawn uniformly (Riot's weights are unpublished).
//  - Each of the 3 cards can be rerolled once -> up to 6 distinct cards seen per screen.
//  - Ability augment cards come with one random eligible ability (uniform).
//  - Golden Reroll (track milestone >= 1): estimated 20% chance per Silver/Gold screen to
//    upgrade one card one tier.

import type { Augment, Build, Champion, ChampStats, GameData, Rarity, Settings, Slot } from "./types";

export const RARITIES: Rarity[] = ["silver", "gold", "prismatic"];
export const CARDS = 3;
export const SEEN_WITH_REROLLS = 6;
export const GOLDEN_REROLL_CHANCE = 0.2; // estimate
export const ANVIL_TIER_ODDS: Record<Rarity, number> = { silver: 0.6, gold: 0.3, prismatic: 0.1 }; // estimate

export interface OddsCtx {
  data: GameData;
  champ: Champion;
  stats: ChampStats | null;
  settings: Settings;
}

const UP: Partial<Record<Rarity, Rarity>> = { silver: "gold", gold: "prismatic" };

/** Rarity distribution of screen `stage` (1..4) given the rarity of the previous screen. */
export function rarityDist(data: GameData, stage: number, prev?: Rarity): Record<Rarity, number> {
  const o = data.odds;
  if (stage > 1 && prev) {
    const t = o.transitions?.[`${stage - 1}-${stage}`]?.[prev];
    if (t) return t;
  }
  const s = o.stages?.[String(stage)];
  if (s) return s;
  return { silver: 0.3, gold: 0.45, prismatic: 0.25 };
}

/** Marginal rarity distribution of a future screen, propagating the chain from the last known rarity. */
export function futureRarityDist(data: GameData, stage: number, lastStage: number, lastRarity?: Rarity): Record<Rarity, number> {
  if (!lastRarity || lastStage < 1) {
    let dist = rarityDist(data, 1);
    for (let s = 2; s <= stage; s++) dist = mix(data, s, dist);
    return dist;
  }
  let dist: Record<Rarity, number> = { silver: 0, gold: 0, prismatic: 0 };
  dist[lastRarity] = 1;
  for (let s = lastStage + 1; s <= stage; s++) dist = mix(data, s, dist);
  return dist;
}

function mix(data: GameData, stage: number, prevDist: Record<Rarity, number>): Record<Rarity, number> {
  const out: Record<Rarity, number> = { silver: 0, gold: 0, prismatic: 0 };
  for (const p of RARITIES) {
    if (!prevDist[p]) continue;
    const t = rarityDist(data, stage, p);
    for (const r of RARITIES) out[r] += prevDist[p] * (t[r] ?? 0);
  }
  return out;
}

export function isUnlocked(_data: GameData, aug: Augment, milestone: number): boolean {
  return aug.trackMilestone == null || aug.trackMilestone <= milestone;
}

/** Is the augment obtainable for this champion at this screen (ignoring what was already offered)? */
export function eligibleAt(o: OddsCtx, aug: Augment, stage: number): boolean {
  if (!aug.enabled || !isUnlocked(o.data, aug, o.settings.milestone)) return false;
  const st = o.stats?.eligible?.[aug.id];
  if (o.stats) {
    if (!st) return false;
    return stage === 0 || st.includes(stage);
  }
  const elig = o.data.eligibility[aug.id];
  if (elig && !elig.includes(o.champ.id)) return false;
  return stage === 0 || aug.stages.includes(stage);
}

export function excludedByBuild(o: OddsCtx, aug: Augment, build: Build): boolean {
  const picked = new Set(build.picks.map((p) => p.aug));
  if (picked.has(aug.id)) return true;
  for (const ex of o.data.synergy.exclusions) {
    if (ex.b && ((ex.a === aug.id && picked.has(ex.b)) || (ex.b === aug.id && picked.has(ex.a)))) return true;
    if (ex.item && ex.a === aug.id && build.lockedItems.includes(ex.item)) return true;
  }
  return false;
}

/** Augments that can appear on screen `stage` with rarity `rarity`, given the current build. */
export function pool(o: OddsCtx, build: Build, stage: number, rarity: Rarity, alreadySeen: Set<string> = new Set()): Augment[] {
  return o.data.augments.filter((a) => a.rarity === rarity && eligibleAt(o, a, stage) &&
    !excludedByBuild(o, a, build) && !alreadySeen.has(a.id));
}

export function seenProbability(n: number, seen = SEEN_WITH_REROLLS): number {
  if (n <= 0) return 0;
  return Math.min(1, seen / n);
}

export function slotProbability(o: OddsCtx, aug: Augment, slot?: Slot): number {
  if (!aug.isAbility || !slot) return 1;
  const slots = o.champ.abilityAugmentSlots[aug.id] ?? [];
  return slots.includes(slot) ? 1 / Math.max(1, slots.length) : 0;
}

export function nextStage(build: Build): number {
  const used = build.picks.filter((p) => p.stage >= 1).map((p) => p.stage);
  for (let s = 1; s <= 4; s++) if (!used.includes(s)) return s;
  return 5;
}

function lastKnown(o: OddsCtx, build: Build, beforeStage: number): { stage: number; rarity?: Rarity } {
  let best = { stage: 0, rarity: undefined as Rarity | undefined };
  for (const p of build.picks) {
    if (p.stage >= 1 && p.stage < beforeStage && p.stage > best.stage) {
      best = { stage: p.stage, rarity: o.data.augmentById.get(p.aug)?.rarity };
    }
  }
  return best;
}

/** P(augment is offered (seen, with rerolls) on a given future screen), given the current build. */
export function offerProbability(o: OddsCtx, build: Build, aug: Augment, stage: number, slot?: Slot): number {
  if (stage > 4 || !eligibleAt(o, aug, stage) || excludedByBuild(o, aug, build)) return 0;
  const last = lastKnown(o, build, stage);
  const dist = futureRarityDist(o.data, stage, last.stage, last.rarity);
  const n = pool(o, build, stage, aug.rarity).length;
  let p = dist[aug.rarity] * seenProbability(n);
  // Golden Reroll: a lower-tier screen can upgrade one card to this tier
  const lower = (Object.keys(UP) as Rarity[]).find((r) => UP[r] === aug.rarity);
  if (lower && o.settings.milestone >= 1) {
    p += dist[lower] * GOLDEN_REROLL_CHANCE * seenProbability(n, 1);
  }
  return Math.min(1, p * slotProbability(o, aug, slot));
}

/** P(offered on at least one of the remaining screens). */
export function offerProbabilityAnyRemaining(o: OddsCtx, build: Build, aug: Augment): number {
  let miss = 1;
  for (let s = nextStage(build); s <= 4; s++) miss *= 1 - offerProbability(o, build, aug, s);
  return 1 - miss;
}

/** Probability that the picks that already happened were offered (how lucky the build is). */
export function buildProbability(o: OddsCtx, build: Build): number {
  let p = 1;
  const sorted = [...build.picks].filter((x) => x.stage >= 1).sort((a, b) => a.stage - b.stage);
  const partial: Build = { ...build, picks: [] };
  let prev: Rarity | undefined;
  for (const pick of sorted) {
    const aug = o.data.augmentById.get(pick.aug);
    if (!aug) continue;
    const dist = rarityDist(o.data, pick.stage, prev);
    const n = pool(o, partial, pick.stage, aug.rarity).length + 1;
    p *= dist[aug.rarity] * seenProbability(n) * slotProbability(o, aug, pick.slot);
    partial.picks = [...partial.picks, pick];
    prev = aug.rarity;
  }
  return p;
}

/** Probability of completing the build with `future` augments on the remaining screens (best assignment summed over orders). */
export function completionProbability(o: OddsCtx, build: Build, future: { aug: string; slot?: Slot }[]): number {
  const stages: number[] = [];
  for (let s = nextStage(build); s <= 4; s++) if (!build.picks.some((p) => p.stage === s)) stages.push(s);
  if (future.length > stages.length) return 0;
  if (!future.length) return 1;
  // Sum over which screens are used (increasing) and which augment comes on each screen.
  // Events overlap slightly, so this is an estimate (capped at 1).
  let total = 0;
  for (const stageSet of combinations(stages, future.length)) {
    for (const augOrder of orderings(future)) {
      let p = 1;
      let b: Build = build;
      const last = lastKnown(o, build, stageSet[0]);
      let prevStage = last.stage;
      let prevRarity = last.rarity;
      for (let i = 0; i < augOrder.length; i++) {
        const aug = o.data.augmentById.get(augOrder[i].aug);
        const stage = stageSet[i];
        if (!aug || !eligibleAt(o, aug, stage)) { p = 0; break; }
        const dist = futureRarityDist(o.data, stage, prevStage, prevRarity);
        const n = pool(o, b, stage, aug.rarity).length;
        p *= dist[aug.rarity] * seenProbability(n) * slotProbability(o, aug, augOrder[i].slot);
        b = { ...b, picks: [...b.picks, { aug: aug.id, stage, slot: augOrder[i].slot }] };
        prevStage = stage;
        prevRarity = aug.rarity;
      }
      total += p;
    }
  }
  return Math.min(1, total);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) out.push([x, ...rest]);
  });
  return out;
}

function orderings<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of orderings(arr.filter((_, j) => j !== i))) out.push([x, ...rest]);
  });
  return out;
}

export function formatOdds(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.995) return "~100%";
  if (p >= 0.01) return `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)}%`;
  return `1 in ${Math.round(1 / p).toLocaleString()}`;
}
