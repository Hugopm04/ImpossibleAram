// Best build scenario (D25, D28, D29): six items incl. boots, with buy order.
// Candidates and their value come from real games conditional on each augment in the build
// (ARAMKit), blended with our tag synergy against the build's augments. Locked items (live
// mode) are kept and the remaining slots are re-optimized.

import type { Build, Item } from "./types";
import { augmentElement, itemElement, pairSynergy, weightedSum, type Ctx } from "./score";

export interface BestBuild {
  items: string[]; // in buy order, boots included
  boots: string | null;
  locked: string[];
  reasons: Record<string, string>;
}

const QUEST_ITEMS: Record<string, string[]> = {
  ARAM_Quest_WoogletsWitchcap: ["228002"],
  ARAM_Quest_VoidImmolation: ["223069"],
  Quest_UltraHydra: ["226668"],
  ARAM_Quest_UrfsChampion: ["994403"],
  ARAM_Quest_SteelYourHeart: ["3084"],
};

function isBoots(it: Item | undefined): boolean {
  return !!it && it.tags.includes("Boots") && (it.gold.total ?? 0) >= 900;
}

function isLegendary(it: Item | undefined): boolean {
  return !!it && !it.tags.includes("Consumable") && !it.tags.includes("Boots") &&
    (it.gold.total ?? 0) >= 2000 && it.into.length === 0 && !it.requiredAlly;
}

export function bestBuild(ctx: Ctx, build: Build, opts: { useLocked?: boolean } = {}): BestBuild {
  const { data, stats } = ctx;
  const locked = opts.useLocked ? build.lockedItems.filter((id) => data.itemById.has(id)) : [];
  const champWr = stats?.champion?.winRate ?? 0.5;
  const score = new Map<string, number>();
  const reasons: Record<string, string> = {};
  const add = (id: string, v: number, why?: string) => {
    score.set(id, (score.get(id) ?? 0) + v);
    if (why && !reasons[id]) reasons[id] = why;
  };
  // champion-wide popular items (baseline)
  for (const [id, wr, pick, n] of stats?.items ?? []) {
    const conf = Math.min(1, n / 2000);
    add(id, 0.6 * pick + 4 * (wr - champWr) * conf);
  }
  // conditional on each augment
  const picks = build.picks;
  for (const p of picks) {
    const b = stats?.builds?.[p.aug];
    if (!b) continue;
    const augName = data.augmentById.get(p.aug)?.name.en ?? p.aug;
    for (const [id, wr, pick, n] of b.items) {
      const conf = Math.min(1, n / 300);
      add(id, 0.8 * pick + 6 * (wr - champWr) * conf, `Strong with ${augName} (${(wr * 100).toFixed(1)}% WR, ${n} games)`);
    }
    for (const id of QUEST_ITEMS[p.aug] ?? []) add(id, 3, `Quest reward of ${augName}`);
  }
  // our synergy against the build's augments
  const augEls = picks.map((p) => augmentElement(ctx, p)).filter(Boolean) as ReturnType<typeof augmentElement>[];
  for (const id of [...score.keys()]) {
    const it = data.itemById.get(id);
    if (!it) { score.delete(id); continue; }
    const el = itemElement(it);
    let syn = 0;
    for (const a of augEls) syn += weightedSum(ctx.settings, pairSynergy(ctx, a!, el));
    syn += weightedSum(ctx.settings, el.base) * 0.5;
    add(id, 0.25 * syn);
  }
  const ranked = [...score.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
  const chosen = [...locked];
  let boots = locked.find((id) => isBoots(data.itemById.get(id))) ?? null;
  if (!boots) {
    boots = ranked.find((id) => isBoots(data.itemById.get(id))) ?? null;
    if (boots) chosen.push(boots);
  }
  const special = new Set(picks.flatMap((p) => QUEST_ITEMS[p.aug] ?? []));
  for (const id of ranked) {
    if (chosen.length >= 6) break;
    if (chosen.includes(id)) continue;
    const it = data.itemById.get(id);
    if (!(isLegendary(it) || special.has(id))) continue;
    if (it?.special && !special.has(id)) continue;
    if (id.length > 4 && !special.has(id)) continue; // mode variants of items
    if (isHydraConflict(chosen, id) && !picks.some((p) => p.aug === "Quest_UltraHydra")) continue;
    chosen.push(id);
  }
  // buy order: ARAMKit purchase order of the strongest augment build if available, else by score
  const order = orderFor(ctx, build, chosen);
  return { items: order, boots, locked, reasons };
}

const HYDRAS = new Set(["3074", "3748", "6698"]);
function isHydraConflict(chosen: string[], id: string): boolean {
  return HYDRAS.has(id) && chosen.some((c) => HYDRAS.has(c));
}

function orderFor(ctx: Ctx, build: Build, chosen: string[]): string[] {
  const routes = build.picks.map((p) => ctx.stats?.builds?.[p.aug]?.order ?? []).filter((r) => r.length);
  const rank = new Map<string, number>();
  for (const r of routes) r.forEach((id, i) => rank.set(id, Math.min(rank.get(id) ?? 99, i)));
  const slotRank = new Map<string, number>();
  ctx.stats?.items?.forEach(([id], i) => slotRank.set(id, i));
  return [...chosen].sort((a, b) => {
    const ia = ctx.data.itemById.get(a);
    const ib = ctx.data.itemById.get(b);
    const ra = (rank.get(a) ?? 50) + (isBoots(ia) ? 0.5 : 0) + (slotRank.get(a) ?? 60) / 100;
    const rb = (rank.get(b) ?? 50) + (isBoots(ib) ? 0.5 : 0) + (slotRank.get(b) ?? 60) / 100;
    return ra - rb;
  });
}
