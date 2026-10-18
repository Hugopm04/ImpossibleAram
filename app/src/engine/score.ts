// Craziness formula (decisions D5–D12, D33–D36, D44–D45 in CLAUDE.md).
//
//   craziness = power × (wG·G + wC·C + wF·F) / (wG + wC + wF)
//   G, C, F   = Σ element base × champion fit × timing   (augments, items, anvil shards)
//             + Σ pairwise synergy rules and curated combos (scaled by both elements' fit)
//             + off-role absurdity bonus on F
//   power     = curated (0.3–1.5) + a·(raw WR − 0.5) + b·(rating − 5.5)/4.5     (D36)
//
// All numbers are "points"; score() maps craziness to a 0–100+ display scale.

import type {
  Anvil, Augment, Build, Champion, ChampStats, FeedbackEntry, GameData, Item, Pick, Rarity, Settings, Slot,
  SynergyRule,
} from "./types";

export const GAME_MINUTES = 17.5; // ARAMKit average game duration (patch 16.20)
export const STAGE_MINUTES: Record<number, number> = { 0: 0, 1: 0, 2: 5, 3: 9.5, 4: 14 };
export const SCORE_REFERENCE = 30; // craziness points that map to 100 (re-calibrated by precompute)

export interface Axes { g: number; c: number; f: number }

export interface Element {
  kind: "champ" | "aug" | "item" | "anvil";
  id: string;
  tags: Set<string>;
  base: Axes;
  fit: number;
  weight: number; // timing × kind factor
}

export interface Contribution {
  kind: "base" | "synergy" | "combo" | "offRole";
  a: string;
  b?: string;
  axes: Axes;
  why?: string;
}

export interface Evaluation {
  axes: Axes;
  power: number;
  powerParts: { curated: number; wr: number | null; wrTerm: number; rating: number | null; ratingTerm: number };
  craziness: number;
  score: number;
  contributions: Contribution[];
  warnings: string[];
}

export interface Ctx {
  data: GameData;
  champ: Champion;
  stats: ChampStats | null;
  settings: Settings;
  feedback: FeedbackEntry[];
  // caches
  augFit: Map<string, number>;
  ruleIndex: Map<string, SynergyRule[]>;
  champElement: Element;
}

export function makeCtx(data: GameData, champ: Champion, stats: ChampStats | null, settings: Settings,
  feedback: FeedbackEntry[]): Ctx {
  const ruleIndex = new Map<string, SynergyRule[]>();
  for (const r of data.synergy.rules) {
    if (!ruleIndex.has(r.a)) ruleIndex.set(r.a, []);
    ruleIndex.get(r.a)!.push(r);
  }
  const champElement: Element = {
    kind: "champ", id: champ.id, tags: new Set(champ.flags.map((f) => `champ:${f}`)),
    base: { g: 0, c: 0, f: 0 }, fit: 1, weight: 1,
  };
  return { data, champ, stats, settings, feedback, augFit: new Map(), ruleIndex, champElement };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------- fit

export function abilitySlotQuality(champ: Champion, slot: Slot): number {
  if (slot === "R") return champ.profile.ult ?? 0.6;
  const ab = champ.abilities.find((a) => a.slot === slot);
  const cd = ab?.cooldownValues?.length ? ab.cooldownValues[ab.cooldownValues.length - 1] : 10;
  return clamp(0.35 + (15 - cd) / 15, 0.3, 1.0);
}

export function bestSlot(champ: Champion, aug: Augment): Slot | undefined {
  const slots = champ.abilityAugmentSlots[aug.id] ?? [];
  let best: Slot | undefined;
  let q = -1;
  for (const s of slots) {
    const v = abilitySlotQuality(champ, s);
    if (v > q) { q = v; best = s; }
  }
  return best;
}

export function augmentFit(ctx: Ctx, aug: Augment, slot?: Slot): number {
  const key = slot ? `${aug.id}:${slot}` : aug.id;
  const cached = ctx.augFit.get(key);
  if (cached !== undefined) return cached;
  const { floor, defaultFit, hooks } = ctx.data.vocabulary;
  const prof = ctx.champ.profile;
  const attrs = new Set<string>();
  for (const t of aug.cur.t) if (hooks[t]) attrs.add(hooks[t]);
  let fit: number;
  if (attrs.size === 0) fit = defaultFit;
  else {
    let logSum = 0;
    for (const a of attrs) logSum += Math.log(floor + (1 - floor) * clamp(prof[a] ?? 0.5, 0, 1));
    fit = Math.exp(logSum / attrs.size);
  }
  for (const [flag, mult] of Object.entries(aug.cur.boost ?? {})) {
    if (ctx.champ.flags.includes(flag)) fit *= mult;
  }
  if (aug.isAbility) {
    const s = slot ?? bestSlot(ctx.champ, aug);
    fit *= s ? 0.55 + 0.45 * abilitySlotQuality(ctx.champ, s) : 0.2;
  }
  fit = clamp(fit, 0.05, 2.2);
  ctx.augFit.set(key, fit);
  return fit;
}

export function timingWeight(time: string, stage: number): number {
  const t = STAGE_MINUTES[stage] ?? 0;
  const left = clamp((GAME_MINUTES - t) / GAME_MINUTES, 0, 1);
  switch (time) {
    case "stack": return 0.35 + 0.65 * left;
    case "quest": return 0.3 + 0.7 * left;
    case "flat": return 0.8 + 0.2 * left;
    default: return 1.0; // late, instant
  }
}

// ---------------------------------------------------------------- elements

const ROLE_ARCHETYPES: Record<string, string[]> = {
  marksman: ["marksman", "crit", "artillery"],
  mage: ["mage", "spellcaster", "burn", "artillery"],
  assassin: ["assassin"],
  fighter: ["fighter", "assassin"],
  tank: ["tank"],
  support: ["enchanter"],
};

export function augmentElement(ctx: Ctx, pick: Pick): Element | null {
  const aug = ctx.data.augmentById.get(pick.aug);
  if (!aug) return null;
  const fit = augmentFit(ctx, aug, pick.slot);
  const w = timingWeight(aug.cur.time, pick.stage || 1);
  return {
    kind: "aug", id: aug.id, tags: new Set([...aug.cur.t, `id:${aug.id}`]),
    base: { g: aug.cur.g, c: aug.cur.c, f: aug.cur.f }, fit, weight: w,
  };
}

export function itemElement(item: Item): Element {
  return {
    kind: "item", id: item.id, tags: new Set([...item.cur.t, `id:${item.id}`]),
    base: { g: item.cur.g, c: item.cur.c, f: item.cur.f }, fit: 1, weight: 1,
  };
}

const SHARD_TAGS: [RegExp, string[], Axes][] = [
  [/_AP$/, ["gives:AP"], { g: 0.7, c: 0, f: 0 }],
  [/_AD$/, ["gives:AD"], { g: 0.7, c: 0, f: 0 }],
  [/_AS$/, ["gives:AS"], { g: 0.6, c: 0, f: 0 }],
  [/_AH$/, ["gives:AH"], { g: 0.6, c: 0, f: 0 }],
  [/_HP$/, ["gives:HP", "gives:size+"], { g: 0.5, c: 0.4, f: 0.2 }],
  [/_AR$/, ["gives:armor"], { g: 0.2, c: 0.4, f: 0 }],
  [/_MR$/, ["gives:MR"], { g: 0.2, c: 0.4, f: 0 }],
  [/_MS$/, ["gives:MS"], { g: 0.2, c: 0.3, f: 0.3 }],
  [/CritChance$/, ["gives:crit"], { g: 0.6, c: 0, f: 0 }],
  [/CritDamage$/, ["amp:crit"], { g: 0.6, c: 0, f: 0 }],
  [/Lethality$|MPen$/, ["gives:pen"], { g: 0.6, c: 0, f: 0 }],
  [/Omnivamp$/, ["gives:omnivamp"], { g: 0.3, c: 0.4, f: 0 }],
  [/Tenacity$/, ["gives:tenacity"], { g: 0, c: 0.5, f: 0 }],
  [/_HS$/, ["gives:HSP"], { g: 0.2, c: 0.4, f: 0 }],
  [/Hybrid1$/, ["gives:AS", "gives:AH"], { g: 0.6, c: 0, f: 0 }],
  [/Hybrid2$/, ["gives:AD", "gives:AP"], { g: 0.6, c: 0, f: 0 }],
  [/Hybrid3$/, ["gives:armor", "gives:MR"], { g: 0.2, c: 0.5, f: 0 }],
  [/Random$/, ["gives:AD", "gives:AP"], { g: 0.8, c: 0.2, f: 0.2 }],
];
const TIER_MULT: Record<Rarity, number> = { silver: 1, gold: 1.6, prismatic: 2.4 };

export function anvilElement(anvil: Anvil, tier: Rarity): Element {
  const hit = SHARD_TAGS.find(([re]) => re.test(anvil.id));
  const tags = hit ? hit[1] : [];
  const base = hit ? hit[2] : { g: 0.3, c: 0.2, f: 0 };
  const m = TIER_MULT[tier];
  return {
    kind: "anvil", id: anvil.id, tags: new Set(tags),
    base: { g: base.g * m, c: base.c * m, f: base.f * m }, fit: 1, weight: 1,
  };
}

// ---------------------------------------------------------------- synergy

function ruleMatches(ctx: Ctx, x: Element, y: Element, out: Contribution[] | null, acc: Axes) {
  const seen = new Set<SynergyRule>();
  const scale = Math.sqrt(Math.max(0.05, x.fit) * Math.max(0.05, y.fit)) *
    (x.kind === "item" && y.kind === "item" ? 0.25 : x.kind === "item" || y.kind === "item" ? 0.5 : 1);
  const apply = (rule: SynergyRule, a: Element, _b: Element) => {
    if (seen.has(rule)) return;
    seen.add(rule);
    let ax: Axes;
    if (rule.x) {
      const extra = (rule.x - 1) * a.weight * a.fit;
      ax = { g: a.base.g * extra, c: 0, f: a.base.f * extra * 0.3 };
    } else {
      ax = { g: (rule.g ?? 0) * scale, c: (rule.c ?? 0) * scale, f: (rule.f ?? 0) * scale };
    }
    acc.g += ax.g; acc.c += ax.c; acc.f += ax.f;
    if (out) out.push({ kind: "synergy", a: a.id, b: _b.id, axes: ax, why: rule.why });
  };
  for (const t of x.tags) {
    const rules = ctx.ruleIndex.get(t);
    if (!rules) continue;
    for (const r of rules) if (y.tags.has(r.b)) apply(r, x, y);
  }
  for (const t of y.tags) {
    const rules = ctx.ruleIndex.get(t);
    if (!rules) continue;
    for (const r of rules) if (x.tags.has(r.b)) apply(r, y, x);
  }
}

/** Synergy points between two elements (used by fast search approximations). */
export function pairSynergy(ctx: Ctx, x: Element, y: Element): Axes {
  const acc = { g: 0, c: 0, f: 0 };
  ruleMatches(ctx, x, y, null, acc);
  for (const cb of ctx.data.synergy.combos) {
    if ((cb.a === x.id && cb.b === y.id) || (cb.a === y.id && cb.b === x.id)) {
      const s = Math.sqrt(x.fit * y.fit);
      acc.g += (cb.g ?? 0) * s; acc.c += (cb.c ?? 0) * s; acc.f += (cb.f ?? 0) * s;
    }
  }
  return acc;
}

// ---------------------------------------------------------------- evaluation

export function weightedSum(settings: Settings, ax: Axes): number {
  const w = settings.weights;
  const tot = w.g + w.c + w.f || 1;
  return (w.g * ax.g + w.c * ax.c + w.f * ax.f) / tot;
}

let scoreReference = SCORE_REFERENCE;
/** Calibrate the display scale (leaderboard.json "reference" = 95th percentile champion ceiling -> 100). */
export function setScoreReference(ref: number | undefined) {
  if (ref && ref > 0) scoreReference = ref;
}

export function toScore(craziness: number): number {
  return (craziness / scoreReference) * 100;
}

function ratingFor(ctx: Ctx, augIds: string[]): number | null {
  if (!augIds.length) return null;
  const set = new Set(augIds);
  let wsum = 0;
  let rsum = 0;
  for (const fb of ctx.feedback) {
    if (fb.champion !== ctx.champ.id || fb.overall == null) continue;
    const other = new Set(fb.augments.map((a) => a.id));
    let inter = 0;
    for (const x of set) if (other.has(x)) inter++;
    const sim = inter / (set.size + other.size - inter);
    if (sim >= 0.5) { wsum += sim; rsum += sim * fb.overall; }
  }
  return wsum ? rsum / wsum : null;
}

function winRateFor(ctx: Ctx, augIds: string[]): number | null {
  const st = ctx.stats;
  if (!st || !augIds.length) return null;
  let sum = 0;
  let n = 0;
  for (const id of augIds) {
    const w = st.wr[id];
    if (w && w[2] > 0) { sum += w[0]; n += 1; }
  }
  const set = new Set(augIds);
  for (const [a, b, wr, samples] of st.pairs) {
    if (samples > 0 && set.has(a) && set.has(b)) { sum += 2 * wr; n += 2; }
  }
  return n ? sum / n : null;
}

export function evaluate(ctx: Ctx, build: Build, items: string[], withDetails = false): Evaluation {
  const { data, champ, settings } = ctx;
  const elements: Element[] = [ctx.champElement];
  const contributions: Contribution[] = [];
  const axes: Axes = { g: 0, c: 0, f: 0 };
  const champArch = new Set(champ.roles.flatMap((r) => ROLE_ARCHETYPES[r] ?? []));
  const augPicks: { el: Element; aug: Augment }[] = [];

  for (const p of build.picks) {
    const el = augmentElement(ctx, p);
    const aug = data.augmentById.get(p.aug);
    if (!el || !aug) continue;
    elements.push(el);
    augPicks.push({ el, aug });
    const k = el.fit * el.weight;
    const ax = { g: el.base.g * k, c: el.base.c * k, f: el.base.f * k };
    axes.g += ax.g; axes.c += ax.c; axes.f += ax.f;
    if (withDetails) contributions.push({ kind: "base", a: aug.id, axes: ax });
    if (aug.buildTagNames.length && el.fit >= 0.5 && !aug.buildTagNames.some((b) => champArch.has(b))) {
      const bonus = { g: 0, c: 0, f: 1.5 * el.fit * el.weight };
      axes.f += bonus.f;
      if (withDetails) contributions.push({ kind: "offRole", a: aug.id, axes: bonus, why: "Off-role pick that still works" });
    }
  }
  for (const id of items) {
    const it = data.itemById.get(id);
    if (!it) continue;
    const el = itemElement(it);
    elements.push(el);
    if (el.base.g || el.base.c || el.base.f) {
      axes.g += el.base.g; axes.c += el.base.c; axes.f += el.base.f;
      if (withDetails) contributions.push({ kind: "base", a: id, axes: { ...el.base } });
    }
  }
  for (const ap of build.anvils) {
    const anvil = ap.shard ? data.anvils.find((a) => a.id === ap.shard) : undefined;
    if (!anvil) continue;
    const el = anvilElement(anvil, ap.tier);
    elements.push(el);
    axes.g += el.base.g; axes.c += el.base.c; axes.f += el.base.f;
    if (withDetails) contributions.push({ kind: "base", a: anvil.id, axes: { ...el.base } });
  }
  // pairwise synergy rules
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      ruleMatches(ctx, elements[i], elements[j], withDetails ? contributions : null, axes);
    }
  }
  // curated combos
  const present = new Map(elements.map((e) => [e.id, e]));
  for (const cb of data.synergy.combos) {
    const x = present.get(cb.a);
    const y = present.get(cb.b);
    if (!x || !y) continue;
    const s = Math.sqrt(x.fit * y.fit);
    const ax = { g: (cb.g ?? 0) * s, c: (cb.c ?? 0) * s, f: (cb.f ?? 0) * s };
    axes.g += ax.g; axes.c += ax.c; axes.f += ax.f;
    if (withDetails) contributions.push({ kind: "combo", a: cb.a, b: cb.b, axes: ax, why: cb.why });
  }
  // power (D36)
  const augIds = augPicks.map((p) => p.aug.id);
  let curated = 1.0;
  if (augPicks.length) {
    const meanP = augPicks.reduce((s, p) => s + p.aug.cur.p, 0) / augPicks.length;
    const meanFit = augPicks.reduce((s, p) => s + Math.min(1, p.el.fit), 0) / augPicks.length;
    curated = clamp(meanP * (0.6 + 0.4 * meanFit), 0.3, 1.5);
  }
  const wr = winRateFor(ctx, augIds);
  const wrTerm = wr == null ? 0 : settings.a * (wr - 0.5);
  const rating = ratingFor(ctx, augIds);
  const ratingTerm = rating == null ? 0 : settings.b * (rating - 5.5) / 4.5;
  const power = clamp(curated + wrTerm + ratingTerm, 0.2, 2.0);
  const craziness = power * weightedSum(settings, axes);
  const warnings = withDetails ? conflicts(ctx, elements) : [];
  return {
    axes, power, powerParts: { curated, wr, wrTerm, rating, ratingTerm }, craziness,
    score: toScore(craziness), contributions, warnings,
  };
}

/** Anti-synergy warnings (D45): never change the score. */
export function conflicts(ctx: Ctx, elements: Element[]): string[] {
  const out: string[] = [];
  const has = (e: Element, key: string) => e.id === key || e.tags.has(key);
  for (const cf of ctx.data.synergy.conflicts) {
    const A = elements.filter((e) => has(e, cf.a));
    const B = elements.filter((e) => has(e, cf.b));
    if (A.length && B.some((b) => !A.includes(b) || A.length > 1)) out.push(cf.why);
  }
  return [...new Set(out)];
}
