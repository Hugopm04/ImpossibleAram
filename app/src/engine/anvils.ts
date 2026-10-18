// Stat Anvils (D13): a special augment type that appears in the ranked list (one entry per
// tier) with a per-shard breakdown. Opening an anvil offers 3 shards of its tier (filtered by
// the champion); the entry's value is the expected best of 3 random eligible shards.

import type { Anvil, Build, Rarity } from "./types";
import { evaluate, type Ctx } from "./score";
import { ANVIL_TIER_ODDS } from "./odds";

export interface ShardValue { anvil: Anvil; gain: number }
export interface AnvilEntry { tier: Rarity; expectedGain: number; shards: ShardValue[]; tierOdds: number }

/** Shards a champion can be offered (requirement tags hypothesis: ap/ad/healShield need the matching kit). */
export function shardsFor(ctx: Ctx, tier: Rarity): Anvil[] {
  const p = ctx.champ.profile;
  return ctx.data.anvils.filter((a) => {
    if (!a.tiers.includes(tier) || /Pristine/.test(a.id)) return false; // no Shardholder Value in Mayhem
    if (a.augmentTagNames.includes("ap") && (p.ap ?? 0) < 0.3) return false;
    if (a.augmentTagNames.includes("ad") && (p.ad ?? 0) < 0.3) return false;
    if (a.augmentTagNames.includes("healShield") && (p.healShield ?? 0) < 0.3 && (p.ally ?? 0) < 0.3) return false;
    return true;
  });
}

/** Expected value of the max of 3 draws without replacement from `gains`. */
export function expectedBestOf(gains: number[], k = 3): number {
  const g = [...gains].sort((a, b) => b - a);
  const n = g.length;
  if (!n) return 0;
  if (n <= k) return g[0];
  let total = 0;
  const denom = choose(n, k);
  for (let j = 0; j < n; j++) total += g[j] * choose(n - j - 1, k - 1) / denom;
  return total;
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function anvilEntries(ctx: Ctx, build: Build, items: string[]): AnvilEntry[] {
  const base = evaluate(ctx, build, items).craziness;
  return (["silver", "gold", "prismatic"] as Rarity[]).map((tier) => {
    const shards = shardsFor(ctx, tier).map((anvil) => ({
      anvil,
      gain: evaluate(ctx, { ...build, anvils: [...build.anvils, { tier, shard: anvil.id }] }, items).craziness - base,
    })).sort((a, b) => b.gain - a.gain);
    return { tier, shards, expectedGain: expectedBestOf(shards.map((s) => s.gain)), tierOdds: ANVIL_TIER_ODDS[tier] };
  });
}
