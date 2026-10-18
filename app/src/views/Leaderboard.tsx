// General stats (D21): craziest combos leaderboard and champion ceilings (precomputed by
// `npm run precompute` with default weights and all track augments unlocked). Scores are
// re-weighted live with the current axis weights (D52); every column with a number is sortable (D53, D54).
import { useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx } from "../i18n";
import { toScore } from "../engine/score";
import { championScores, comboRows, type ScoredBuild } from "../engine/leaderboard";
import type { LeaderboardBuild } from "../engine/types";
import { AugmentRef } from "../components/cards";
import { SortTh, directed, useSort } from "../components/Sort";
import { ItemsRow, Odds } from "./common";

type Key = "name" | "score" | "g" | "c" | "f" | "probability" | "expected";

function BuildCell({ b, champ }: { b: LeaderboardBuild; champ: string }) {
  const { data, loc } = useApp();
  const c = data?.championById.get(champ) ?? null;
  const found = b.found && b.found !== "craziness" ? b.found : null;
  return (
    <div>
      {b.picks.map((p, i) => <span key={p.aug}>{i > 0 && " + "}<AugmentRef id={p.aug} champ={c} slot={p.slot} /></span>)}
      {found && <span className="foundchip" style={{ color: `var(--${found})` }} title={t(loc, "foundTip")}>{t(loc, "maxAxis")} {found.toUpperCase()}</span>}
      <div className="path">{b.highlights.slice(0, 2).map((h) => h.why).filter(Boolean).join(" · ")}</div>
    </div>
  );
}

export function Leaderboard({ mode }: { mode: "combos" | "ceilings" }) {
  const { data, loc, settings, setBuild, setView } = useApp();
  const [q, setQ] = useState("");
  const [onePer, setOnePer] = useState(true);
  const [limit, setLimit] = useState(200);
  const sort = useSort<Key>("score", ["name"]);
  const lb = data?.leaderboard ?? null;
  const champScores = useMemo(() => championScores(lb, settings), [lb, settings.weights]);
  const combos = useMemo(() => comboRows(lb, settings), [lb, settings.weights]);
  if (!data) return null;
  if (!lb) return <div className="panel empty">Run <span className="kbd">npm run precompute</span> to build the leaderboard.</div>;

  const nameOf = (id: string) => tx(loc, data.championById.get(id)?.name) || id;
  const match = (id: string) => !q || nameOf(id).toLowerCase().includes(q.toLowerCase());
  const value = (b: ScoredBuild, k: Key): number => {
    switch (k) {
      case "g": return b.axes.g;
      case "c": return b.axes.c;
      case "f": return b.axes.f;
      case "probability": return b.probability;
      case "expected": return champScores.get(b.champion)?.expected ?? 0;
      default: return b.score;
    }
  };
  const cmp = directed<ScoredBuild>(sort.dir, (a, b) =>
    sort.key === "name" ? nameOf(a.champion).localeCompare(nameOf(b.champion)) || b.score - a.score : value(a, sort.key) - value(b, sort.key));

  const rows: ScoredBuild[] = mode === "combos"
    ? combos.filter((c) => match(c.champion)).sort(cmp)
      .filter((c, i, all) => !onePer || all.findIndex((x) => x.champion === c.champion) === i)
    : [...champScores.values()].filter((c) => match(c.id)).map((c) => c.best).sort(cmp);

  const open = (b: ScoredBuild) => {
    setBuild({ champion: b.champion, picks: b.picks, anvils: [], lockedItems: [] });
    setView("planner");
  };
  const champCell = (id: string) => {
    const c = data.championById.get(id);
    return c ? <div className="row" style={{ gap: 8 }}><img src={c.icon} alt="" style={{ width: 32, height: 32, borderRadius: 4 }} /> {tx(loc, c.name)}</div> : id;
  };
  return (
    <div className="panel">
      <h2>{mode === "combos" ? t(loc, "leaderboard") : t(loc, "ceilings")}</h2>
      <div className="small muted" style={{ marginBottom: 8 }}>{t(loc, "ceilingNote")} · patch {lb.patch}</div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input" placeholder={t(loc, "search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        {mode === "combos" && <label className="small muted"><input type="checkbox" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} /> {t(loc, "onePerChampion")}</label>}
        <span className="small muted">{rows.length} {mode === "combos" ? t(loc, "builds") : t(loc, "champions")}</span>
      </div>
      <table className="list">
        <thead>
          <tr>
            <th>#</th>
            <SortTh k="name" sort={sort}>{t(loc, "champion")}</SortTh>
            <th>{t(loc, "build")}</th>
            <SortTh k="score" sort={sort}>{mode === "combos" ? t(loc, "score") : t(loc, "ceiling")}</SortTh>
            <SortTh k="g" sort={sort} title={t(loc, "G")}>G</SortTh>
            <SortTh k="c" sort={sort} title={t(loc, "C")}>C</SortTh>
            <SortTh k="f" sort={sort} title={t(loc, "F")}>F</SortTh>
            <SortTh k="probability" sort={sort}>{t(loc, "probability")}</SortTh>
            {mode === "ceilings" && <SortTh k="expected" sort={sort}>{t(loc, "expectedFirst")}</SortTh>}
            <th>{t(loc, "buildItems")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((b, i) => (
            <tr key={`${b.champion}:${b.picks.map((p) => p.aug).join(",")}`}>
              <td className="num">{i + 1}</td>
              <td>{champCell(b.champion)}</td>
              <td><BuildCell b={b} champ={b.champion} /></td>
              <td className="num big">{toScore(b.score).toFixed(0)}</td>
              <td className="num small" style={{ color: "var(--g)" }}>{b.axes.g.toFixed(0)}</td>
              <td className="num small" style={{ color: "var(--c)" }}>{b.axes.c.toFixed(0)}</td>
              <td className="num small" style={{ color: "var(--f)" }}>{b.axes.f.toFixed(0)}</td>
              <td className="num small"><Odds p={b.probability} /></td>
              {mode === "ceilings" && <td className="num">{toScore(champScores.get(b.champion)?.expected ?? 0).toFixed(0)}</td>}
              <td><ItemsRow bb={b.items} /></td>
              <td><button className="btn" onClick={() => open(b)}>{t(loc, "open")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        <button className="btn ghost" onClick={() => setLimit(rows.length)}>{t(loc, "showAll")} ({rows.length})</button>
      </div>}
    </div>
  );
}
