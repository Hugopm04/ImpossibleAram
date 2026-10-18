import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx } from "../i18n";
import { makeCtx, toScore, type Ctx, type Evaluation } from "../engine/score";
import { championScores } from "../engine/leaderboard";
import { bestBuild, type BestBuild } from "../engine/items";
import { buildProbability, formatOdds } from "../engine/odds";
import type { Build, Champion } from "../engine/types";
import { AbilityRef, AugmentRef, ItemRef } from "../components/cards";
import { oddsCtx } from "../engine/search";
import { SortBar, directed, useSort } from "../components/Sort";

export function useEngineCtx(): Ctx | null {
  const { data, build, stats, settings, feedback } = useApp();
  return useMemo(() => {
    if (!data || !build) return null;
    const champ = data.championById.get(build.champion);
    if (!champ) return null;
    return makeCtx(data, champ, stats, settings, feedback);
  }, [data, build?.champion, stats, settings, feedback]);
}

/** Run a heavy computation after paint so the UI can show "Computing…". */
export function useDeferredCompute<T>(fn: () => T, deps: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    setValue(null);
    const h = window.setTimeout(() => setValue(fn()), 15);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

type ChampSortKey = "ceiling" | "expected" | "name" | "g" | "c" | "f";

/** Champion grid for Planner and Live (D51): score badge per tile, sorted by craziness ceiling by default. */
export function ChampionPicker({ onPick }: { onPick: (c: Champion) => void }) {
  const { data, loc, settings } = useApp();
  const [q, setQ] = useState("");
  const sort = useSort<ChampSortKey>("ceiling", ["name"]);
  const scores = useMemo(() => championScores(data?.leaderboard ?? null, settings), [data, settings.weights]);
  if (!data) return null;
  const value = (c: Champion): number | null => {
    const s = scores.get(c.id);
    if (!s) return null;
    switch (sort.key) {
      case "expected": return s.expected;
      case "g": return s.best.axes.g;
      case "c": return s.best.axes.c;
      case "f": return s.best.axes.f;
      default: return s.ceiling;
    }
  };
  const byName = (a: Champion, b: Champion) => tx(loc, a.name).localeCompare(tx(loc, b.name));
  const list = data.champions
    .filter((c) => !q || tx(loc, c.name).toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sort.key === "name") return directed(sort.dir, byName)(a, b);
      const va = value(a);
      const vb = value(b);
      if (va == null || vb == null) return va == null && vb == null ? byName(a, b) : va == null ? 1 : -1; // unscored last
      return directed<number>(sort.dir, (x, y) => x - y)(va, vb) || byName(a, b);
    });
  const badge = (c: Champion) => {
    const s = scores.get(c.id);
    if (!s) return <b className="tile-score none" title={t(loc, "noScore")}>—</b>;
    const shown = sort.key === "expected" ? toScore(s.expected)
      : sort.key === "g" || sort.key === "c" || sort.key === "f" ? s.best.axes[sort.key] : toScore(s.ceiling);
    return <b className="tile-score" style={sort.key.length === 1 ? { color: `var(--${sort.key})` } : undefined}>{shown.toFixed(0)}</b>;
  };
  return (
    <div className="panel">
      <h2>{t(loc, "selectChampion")}</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" autoFocus placeholder={t(loc, "search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        <SortBar sort={sort} label={`${t(loc, "sortBy")}:`} options={[
          { k: "ceiling", label: t(loc, "ceiling") }, { k: "expected", label: t(loc, "expected") }, { k: "name", label: t(loc, "name") },
          { k: "g", label: "G" }, { k: "c", label: "C" }, { k: "f", label: "F" },
        ]} />
      </div>
      <div className="champ-grid">
        {list.map((c) => (
          <button key={c.id} className="champ-tile" onClick={() => onPick(c)} title={tx(loc, c.title)}>
            <img src={c.icon} alt="" loading="lazy" />
            <span>{tx(loc, c.name)}</span>
            {badge(c)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function emptyBuild(champion: string): Build {
  return { champion, picks: [], anvils: [], lockedItems: [] };
}

export function AxesPanel({ ev, compact }: { ev: Evaluation; compact?: boolean }) {
  const { loc } = useApp();
  const max = Math.max(20, ev.axes.g, ev.axes.c, ev.axes.f);
  const axis = (k: "g" | "c" | "f", label: string) => (
    <div className="axis" key={k}>
      <span>{label}</span>
      <div className={`bar ${k}`}><i style={{ width: `${Math.min(100, (ev.axes[k] / max) * 100)}%` }} /></div>
      <span className="num">{ev.axes[k].toFixed(1)}</span>
    </div>
  );
  return (
    <div className="axes">
      {!compact && (
        <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
          <div className="bigscore">{ev.score.toFixed(0)}<small> / 100</small></div>
          <div className="muted small">{t(loc, "craziness")} {ev.craziness.toFixed(1)} · {t(loc, "power")} ×{ev.power.toFixed(2)}</div>
        </div>
      )}
      {axis("g", t(loc, "G"))}
      {axis("c", t(loc, "C"))}
      {axis("f", t(loc, "F"))}
      {!compact && (
        <div className="small muted">
          {t(loc, "power")}: {t(loc, "curated")} {ev.powerParts.curated.toFixed(2)}
          {ev.powerParts.wr != null && <> · WR {(ev.powerParts.wr * 100).toFixed(1)}% ({ev.powerParts.wrTerm >= 0 ? "+" : ""}{ev.powerParts.wrTerm.toFixed(2)})</>}
          {ev.powerParts.rating != null && <> · {t(loc, "rating")} {ev.powerParts.rating.toFixed(1)} ({ev.powerParts.ratingTerm >= 0 ? "+" : ""}{ev.powerParts.ratingTerm.toFixed(2)})</>}
        </div>
      )}
    </div>
  );
}

export function ItemsRow({ bb, locked = [] }: { bb: BestBuild | string[]; locked?: string[] }) {
  const ids = Array.isArray(bb) ? bb : bb.items;
  return (
    <span className="row" style={{ gap: 3 }}>
      {ids.map((id) => (
        <span key={id} className={locked.includes(id) ? "lockedwrap" : ""}>
          <ItemRef id={id} icon />
        </span>
      ))}
    </span>
  );
}

export function Odds({ p, estimate = true }: { p: number; estimate?: boolean }) {
  const { loc } = useApp();
  return (
    <span>
      {formatOdds(p)}{estimate && p > 0 && <> <span className="est" title={t(loc, "estimateTip")}>est.</span></>}
    </span>
  );
}

export function BuildLuck({ ctx, build }: { ctx: Ctx; build: Build }) {
  const { loc } = useApp();
  if (!build.picks.some((p) => p.stage >= 1)) return null;
  const p = buildProbability(oddsCtx(ctx), build);
  return <div className="small muted">{t(loc, "buildLuck")}: <b style={{ color: "var(--gold-hi)" }}><Odds p={p} /></b></div>;
}

export function Contributions({ ev, ctx }: { ev: Evaluation; ctx: Ctx }) {
  const { loc, data } = useApp();
  if (!data) return null;
  const nameOf = (id?: string) => {
    if (!id) return "";
    if (data.augmentById.has(id)) return <AugmentRef id={id} champ={ctx.champ} />;
    if (data.itemById.has(id)) return <ItemRef id={id} />;
    if (id === ctx.champ.id) return tx(loc, ctx.champ.name);
    const anvil = data.anvils.find((a) => a.id === id);
    return anvil ? tx(loc, anvil.name) : id;
  };
  const rows = ev.contributions.filter((c) => c.kind !== "base")
    .sort((a, b) => (b.axes.g + b.axes.c + b.axes.f) - (a.axes.g + a.axes.c + a.axes.f)).slice(0, 8);
  if (!rows.length) return null;
  return (
    <div className="card-section">
      <h3>{t(loc, "why")}</h3>
      {rows.map((c, i) => (
        <div key={i} className="small" style={{ marginBottom: 3 }}>
          <span style={{ color: "var(--g)" }}>+{c.axes.g.toFixed(1)}</span>/<span style={{ color: "var(--c)" }}>{c.axes.c.toFixed(1)}</span>/<span style={{ color: "var(--f)" }}>{c.axes.f.toFixed(1)}</span>{" "}
          {nameOf(c.a)}{c.b ? <> × {nameOf(c.b)}</> : null} <span className="muted">— {c.kind === "offRole" ? t(loc, "offRole") : c.why}</span>
        </div>
      ))}
    </div>
  );
}

export function SlotPicker({ champ, augId, value, onChange }: { champ: Champion; augId: string; value?: string; onChange: (s: string) => void }) {
  const { loc } = useApp();
  const slots = champ.abilityAugmentSlots[augId] ?? [];
  if (slots.length <= 1) return slots[0] ? <span className="small muted"><AbilityRef champ={champ} slot={slots[0]}>{slots[0]}</AbilityRef></span> : null;
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} title={t(loc, "chooseSlot")} style={{ padding: "2px 4px" }}>
      {slots.map((s) => <option key={s} value={s}>{s} · {tx(loc, champ.abilities.find((a) => a.slot === s)?.name)}</option>)}
    </select>
  );
}

export function useBestBuilds(ctx: Ctx | null, build: Build | null) {
  return useMemo(() => {
    if (!ctx || !build) return null;
    const free = bestBuild(ctx, build);
    const locked = build.lockedItems.length ? bestBuild(ctx, build, { useLocked: true }) : null;
    return { free, locked };
  }, [ctx, build]);
}
