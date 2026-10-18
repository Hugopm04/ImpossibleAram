// Precompute the general-stats views (D21): craziest combos leaderboard and champion ceilings.
//   npm run precompute            (all champions, ~minutes)
//   npm run precompute -- Veigar  (only some champions, for testing)
// Writes public/data/leaderboard.json. Uses default settings (D32 weights, milestone 32 = all
// track augments unlocked) and no feedback, so it is a neutral reference.
import fs from "node:fs";
import path from "node:path";
import { loadChampStats, loadGameData } from "../src/engine/data";
import { evaluate, makeCtx } from "../src/engine/score";
import { beamSearch, oddsCtx, rankCandidates } from "../src/engine/search";
import { bestBuild } from "../src/engine/items";
import { completionProbability } from "../src/engine/odds";
import { DEFAULT_SETTINGS } from "../src/engine/settings";
import type { Build } from "../src/engine/types";
import { DATA_DIR, nodeReader } from "./nodeData";

const only = process.argv.slice(2);
const data = await loadGameData(nodeReader);
const settings = { ...DEFAULT_SETTINGS, milestone: 32 };
const champs = data.champions.filter((c) => !only.length || only.includes(c.id));
const out: any[] = [];
const t0 = performance.now();
for (const champ of champs) {
  const stats = await loadChampStats(nodeReader, champ.id);
  const ctx = makeCtx(data, champ, stats, settings, []);
  const empty: Build = { champion: champ.id, picks: [], anvils: [], lockedItems: [] };
  const baseItems = bestBuild(ctx, empty).items;
  const results = beamSearch(ctx, () => baseItems, 8);
  const top = results.slice(0, 3).map((r) => {
    const items = bestBuild(ctx, r.build).items;
    const ev = evaluate(ctx, r.build, items, true);
    const prob = completionProbability(oddsCtx(ctx), empty, r.build.picks.map((p) => ({ aug: p.aug, slot: p.slot })));
    return {
      picks: r.build.picks, items, craziness: round(ev.craziness), axes: roundAxes(ev.axes), power: round(ev.power),
      probability: prob,
      highlights: ev.contributions.filter((c) => c.kind !== "base").sort((a, b) => mag(b.axes) - mag(a.axes))
        .slice(0, 4).map((c) => ({ a: c.a, b: c.b, why: c.why })),
    };
  });
  const exp = rankCandidates(ctx, empty, { items: baseItems, limit: 1 })[0];
  out.push({ id: champ.id, best: top[0], top, expected: round(exp?.expected ?? 0), expectedFirst: exp?.aug.id });
  process.stdout.write(`${champ.id} ${top[0]?.craziness} (${((performance.now() - t0) / 1000).toFixed(0)}s)\n`);
}
const all = out.flatMap((c) => c.top.map((b: any) => ({ champion: c.id, ...b }))).sort((a, b) => b.craziness - a.craziness);
const bests = out.map((c) => c.best?.craziness ?? 0).sort((a, b) => a - b);
const reference = bests.length ? bests[Math.floor(bests.length * 0.95)] || bests[bests.length - 1] : 30;
const file = path.join(DATA_DIR, "leaderboard.json");
const prev = fs.existsSync(file) && only.length ? JSON.parse(fs.readFileSync(file, "utf-8")) : null;
const result = prev && only.length
  ? { ...prev, champions: [...prev.champions.filter((c: any) => !only.includes(c.id)), ...out] }
  : {
    builtAt: new Date().toISOString(), patch: data.meta.patch, reference: round(reference),
    settings: { weights: settings.weights, milestone: settings.milestone }, champions: out, combos: all.slice(0, 150),
  };
fs.writeFileSync(file, JSON.stringify(result));
console.log(`wrote ${file} (${out.length} champions, reference ${round(reference)})`);

function round(x: number) { return Math.round(x * 100) / 100; }
function roundAxes(a: { g: number; c: number; f: number }) { return { g: round(a.g), c: round(a.c), f: round(a.f) }; }
function mag(a: { g: number; c: number; f: number }) { return a.g + a.c + a.f; }
