// Engine smoke test: `npx tsx scripts/smoke.ts [Champion]` prints top candidates and timings.
import { loadChampStats, loadGameData } from "../src/engine/data";
import { makeCtx, evaluate } from "../src/engine/score";
import { rankCandidates } from "../src/engine/search";
import { bestBuild } from "../src/engine/items";
import { formatOdds } from "../src/engine/odds";
import { DEFAULT_SETTINGS } from "../src/engine/settings";
import type { Build } from "../src/engine/types";
import { nodeReader } from "./nodeData";

const champId = process.argv[2] ?? "Veigar";
const data = await loadGameData(nodeReader);
const champ = data.championById.get(champId)!;
const stats = await loadChampStats(nodeReader, champId);
const ctx = makeCtx(data, champ, stats, { ...DEFAULT_SETTINGS, milestone: 32 }, []);
let build: Build = { champion: champId, picks: [], anvils: [], lockedItems: [] };
for (let step = 0; step < 4; step++) {
  const t0 = performance.now();
  const items = bestBuild(ctx, build).items;
  const rows = rankCandidates(ctx, build, { items, limit: 8 });
  const ms = performance.now() - t0;
  console.log(`\n== ${champId} screen ${step + 1} (${ms.toFixed(0)} ms) items: ${items.map((i) => data.itemById.get(i)?.name.en).join(", ")}`);
  for (const r of rows) {
    console.log(`${r.aug.name.en.padEnd(28)} ${r.aug.rarity.padEnd(9)} now ${r.now.toFixed(1).padStart(5)} best ${r.best.toFixed(1).padStart(5)} exp ${r.expected.toFixed(1).padStart(5)} pNext ${formatOdds(r.pNext).padStart(8)} pBest ${formatOdds(r.bestProbability).padStart(12)} path: ${r.bestPath.map((p) => data.augmentById.get(p.aug)?.name.en).join(" > ")}`);
  }
  const top = rows[0];
  build = { ...build, picks: [...build.picks, { aug: top.aug.id, stage: top.stage, slot: top.slot }] };
}
const items = bestBuild(ctx, build).items;
const ev = evaluate(ctx, build, items, true);
console.log("\nFinal:", build.picks.map((p) => data.augmentById.get(p.aug)?.name.en).join(" + "));
console.log("axes", ev.axes, "power", ev.powerParts, "craziness", ev.craziness.toFixed(1), "score", ev.score.toFixed(0));
console.log("warnings", ev.warnings);
for (const c of ev.contributions.filter((c) => c.kind !== "base").slice(0, 12)) console.log(" ", c.kind, c.a, c.b ?? "", JSON.stringify(c.axes), c.why ?? "");
