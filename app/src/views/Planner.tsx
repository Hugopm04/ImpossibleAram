import { useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx, TYPE_NAMES } from "../i18n";
import { rankCandidates, type Candidate } from "../engine/search";
import { bestBuild } from "../engine/items";
import { anvilEntries } from "../engine/anvils";
import { nextStage } from "../engine/odds";
import { toScore } from "../engine/score";
import type { Build, Rarity, Settings, Slot } from "../engine/types";
import { AnvilCard, AugIcon, AugmentRef, RarityBadge } from "../components/cards";
import { HoverRef } from "../components/Hover";
import { ChampionPicker, ItemsRow, Odds, SlotPicker, emptyBuild, useBestBuilds, useDeferredCompute, useEngineCtx } from "./common";
import { BuildPanel } from "./BuildPanel";
import { WeightSliders } from "./Settings";
import { SortTh, type Dir, type SortState } from "../components/Sort";

export function Planner() {
  const { data, build, setBuild } = useApp();
  const ctx = useEngineCtx();
  if (!data) return null;
  if (!build || !ctx) return <ChampionPicker onPick={(c) => setBuild(emptyBuild(c.id))} />;
  return (
    <div className="grid-planner">
      <div style={{ display: "grid", gap: 16 }}>
        <BuildPanel ctx={ctx} build={build} />
        <div className="panel"><WeightSliders /></div>
      </div>
      <RankedList build={build} />
    </div>
  );
}

export function RankedList({ build, filterIds }: { build: Build; filterIds?: string[] }) {
  const { loc, settings, setSettings, setBuild, data } = useApp();
  const ctx = useEngineCtx();
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [asExtra, setAsExtra] = useState(false);
  const [dir, setDir] = useState<Dir>("desc");
  // the engine sorts by settings.sortBy (persisted); the direction is local (D54)
  const sort: SortState<Settings["sortBy"]> = {
    key: settings.sortBy, dir,
    set: (k) => {
      if (k === settings.sortBy) setDir(dir === "asc" ? "desc" : "asc");
      else { setSettings({ sortBy: k }); setDir("desc"); }
    },
  };
  const stage = nextStage(build);
  const bbs = useBestBuilds(ctx, build);
  const items = bbs?.free.items ?? [];
  const rows = useDeferredCompute<Candidate[]>(
    () => (ctx && stage <= 4 ? rankCandidates(ctx, build, { items, limit: 400 }) : []),
    [ctx, build, items.join(","), settings.sortBy],
  );
  const anvils = useMemo(() => (ctx ? anvilEntries(ctx, build, items) : []), [ctx, build, items.join(",")]);
  const filtered = useMemo(() => {
    const out = (rows ?? []).filter((r) =>
      (!filterIds || filterIds.includes(r.aug.id)) &&
      (rarity === "all" || r.aug.rarity === rarity) &&
      (type === "all" || r.aug.type === type) &&
      (!q || tx(loc, r.aug.name).toLowerCase().includes(q.toLowerCase())));
    return dir === "asc" ? out.reverse() : out;
  }, [rows, rarity, type, q, loc, filterIds, dir]);
  const visible = filtered.slice(0, 60);
  const perRowBuilds = useMemo(() => {
    if (!ctx) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    for (const r of visible.slice(0, 40)) {
      const nb: Build = { ...build, picks: [...build.picks, { aug: r.aug.id, stage: r.stage, slot: r.slot }] };
      m.set(r.aug.id, bestBuild(ctx, nb).items);
    }
    return m;
  }, [ctx, build, visible.map((r) => r.aug.id).join(",")]);
  if (!ctx || !data) return null;

  const pick = (r: Candidate) => {
    const slot = slots[r.aug.id] ?? r.slot;
    setBuild({ ...build, picks: [...build.picks, { aug: r.aug.id, stage: asExtra ? 0 : r.stage, slot }] });
  };
  const types = [...new Set(data.augments.map((a) => a.type).filter(Boolean))].sort();

  return (
    <div className="panel">
      <h2>{stage <= 4 ? `${t(loc, "screen")} ${stage}` : t(loc, "fullBuild")}</h2>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input list-search" placeholder={t(loc, "search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
        <select className="input" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | "all")}>
          <option value="all">{t(loc, "rarity")}: {t(loc, "all")}</option>
          {(["silver", "gold", "prismatic"] as Rarity[]).map((r) => <option key={r} value={r}>{t(loc, r)}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">{t(loc, "type")}: {t(loc, "all")}</option>
          {types.map((x) => <option key={x} value={x}>{tx(loc, TYPE_NAMES[x])}</option>)}
        </select>
        <label className="small muted"><input type="checkbox" checked={asExtra} onChange={(e) => setAsExtra(e.target.checked)} /> {t(loc, "extra")} (Transmute…)</label>
      </div>

      {stage <= 4 && anvils.length > 0 && !filterIds && (
        <table className="list">
          <tbody>
            {anvils.map((a) => (
              <tr key={a.tier}>
                <td>
                  <div className="augcell">
                    <span className={`rar-${a.tier}`}><img className="aug-icon" src={a.shards[0]?.anvil.icon ?? ""} alt="" /></span>
                    <div>
                      <div className="augname">{t(loc, "anvil")} <RarityBadge rarity={a.tier} loc={loc} /></div>
                      <span className="est" title={t(loc, "anvilTip")}>{t(loc, "anvils")}</span>
                    </div>
                  </div>
                </td>
                <td className="num">+{a.expectedGain.toFixed(1)}</td>
                <td colSpan={3} className="small">
                  {a.shards.slice(0, 6).map((s) => (
                    <HoverRef key={s.anvil.id} hoverKey={`shard:${a.tier}:${s.anvil.id}`} className="hover-ref" render={() => <AnvilCard anvil={s.anvil} tier={a.tier} />}>
                      <span style={{ marginRight: 8 }}>{tx(loc, s.anvil.name)} <b>+{s.gain.toFixed(1)}</b></span>
                    </HoverRef>
                  ))}
                </td>
                <td className="num small"><Odds p={a.tierOdds} /></td>
                <td>
                  <button className="btn" onClick={() => a.shards[0] && setBuild({ ...build, anvils: [...build.anvils, { tier: a.tier, shard: a.shards[0].anvil.id }] })}>{t(loc, "addAnvil")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows == null ? <div className="spinner">{t(loc, "computing")}</div> : (
        <table className="list">
          <thead>
            <tr>
              <th>{t(loc, "augment")}</th>
              <SortTh k="now" sort={sort}>{t(loc, "now")}</SortTh>
              <SortTh k="best" sort={sort}>{t(loc, "best")}</SortTh>
              <SortTh k="expected" sort={sort}>{t(loc, "expected")}</SortTh>
              <SortTh k="probability" sort={sort}>{t(loc, "pNext")}</SortTh>
              <th>{t(loc, "pBest")}</th>
              <th>{t(loc, "buildItems")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.aug.id}>
                <td>
                  <div className="augcell">
                    <AugIcon aug={r.aug} />
                    <div>
                      <div className="augname"><AugmentRef id={r.aug.id} champ={ctx.champ} slot={slots[r.aug.id] ?? r.slot} /></div>
                      <div className="row" style={{ gap: 4 }}>
                        <RarityBadge rarity={r.aug.rarity} loc={loc} />
                        {r.aug.type && <span className="typechip">{tx(loc, TYPE_NAMES[r.aug.type])}</span>}
                        {r.aug.isAbility && <SlotPicker champ={ctx.champ} augId={r.aug.id} value={slots[r.aug.id] ?? r.slot}
                          onChange={(s) => setSlots({ ...slots, [r.aug.id]: s as Slot })} />}
                        {r.nowEval.warnings.length > 0 && <span className="warn" title={r.nowEval.warnings.join("\n")}>⚠</span>}
                      </div>
                      {r.bestPath.length > 0 && (
                        <div className="path">→ {r.bestPath.map((p, i) => (
                          <span key={p.aug}>{i > 0 && " → "}<AugmentRef id={p.aug} champ={ctx.champ} slot={p.slot} /></span>
                        ))}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="num">{toScore100(r.now)}</td>
                <td className="num big">{toScore100(r.best)}</td>
                <td className="num">{toScore100(r.expected)}</td>
                <td className="num small"><Odds p={r.pNext} /></td>
                <td className="num small"><Odds p={r.bestProbability} /></td>
                <td>{perRowBuilds.has(r.aug.id) ? <ItemsRow bb={perRowBuilds.get(r.aug.id)!} /> : null}</td>
                <td><button className="btn" onClick={() => pick(r)}>{t(loc, "pick")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && filtered.length === 0 && <div className="empty">—</div>}
    </div>
  );
}

function toScore100(c: number): string {
  return toScore(c).toFixed(0);
}
