// General stats (D21): craziest combos leaderboard and champion ceilings (precomputed by
// `npm run precompute` with default weights and all track augments unlocked).
import { useState } from "react";
import { useApp } from "../state";
import { t, tx } from "../i18n";
import { toScore } from "../engine/score";
import type { LeaderboardBuild } from "../engine/types";
import { AugmentRef } from "../components/cards";
import { ItemsRow, Odds } from "./common";

function BuildCell({ b, champ }: { b: LeaderboardBuild; champ: string }) {
  const { data } = useApp();
  const c = data?.championById.get(champ) ?? null;
  return (
    <div>
      {b.picks.map((p, i) => <span key={p.aug}>{i > 0 && " + "}<AugmentRef id={p.aug} champ={c} slot={p.slot} /></span>)}
      <div className="path">{b.highlights.slice(0, 2).map((h) => h.why).filter(Boolean).join(" · ")}</div>
    </div>
  );
}

export function Leaderboard({ mode }: { mode: "combos" | "ceilings" }) {
  const { data, loc, setBuild, setView } = useApp();
  const [q, setQ] = useState("");
  const [onePer, setOnePer] = useState(true);
  const lb = data?.leaderboard;
  if (!data) return null;
  if (!lb) return <div className="panel empty">Run <span className="kbd">npm run precompute</span> to build the leaderboard.</div>;
  const open = (champ: string, b: LeaderboardBuild) => {
    setBuild({ champion: champ, picks: b.picks, anvils: [], lockedItems: [] });
    setView("planner");
  };
  const champCell = (id: string) => {
    const c = data.championById.get(id);
    return c ? <div className="row" style={{ gap: 8 }}><img src={c.icon} alt="" style={{ width: 32, height: 32, borderRadius: 4 }} /> {tx(loc, c.name)}</div> : id;
  };
  const match = (id: string) => !q || tx(loc, data.championById.get(id)?.name).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="panel">
      <h2>{mode === "combos" ? t(loc, "leaderboard") : t(loc, "ceilings")}</h2>
      <div className="small muted" style={{ marginBottom: 8 }}>{t(loc, "ceilingNote")} · patch {lb.patch}</div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input" placeholder={t(loc, "search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        {mode === "combos" && <label className="small muted"><input type="checkbox" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} /> {t(loc, "onePerChampion")}</label>}
      </div>
      <table className="list">
        <thead>
          <tr>
            <th>#</th><th>{t(loc, "champion")}</th><th>{t(loc, "build")}</th><th>{t(loc, "score")}</th>
            <th>G / C / F</th><th>{t(loc, "probability")}</th>{mode === "ceilings" && <th>{t(loc, "expectedFirst")}</th>}<th>{t(loc, "buildItems")}</th><th />
          </tr>
        </thead>
        <tbody>
          {mode === "combos"
            ? lb.combos.filter((c, i, all) => match(c.champion) && (!onePer || all.findIndex((x) => x.champion === c.champion) === i)).map((c, i) => (
              <tr key={`${c.champion}${i}`}>
                <td className="num">{i + 1}</td>
                <td>{champCell(c.champion)}</td>
                <td><BuildCell b={c} champ={c.champion} /></td>
                <td className="num big">{toScore(c.craziness).toFixed(0)}</td>
                <td className="num small">{c.axes.g.toFixed(0)} / {c.axes.c.toFixed(0)} / {c.axes.f.toFixed(0)}</td>
                <td className="num small"><Odds p={c.probability} /></td>
                <td><ItemsRow bb={c.items} /></td>
                <td><button className="btn" onClick={() => open(c.champion, c)}>{t(loc, "open")}</button></td>
              </tr>
            ))
            : [...lb.champions].filter((c) => c.best && match(c.id)).sort((a, b) => b.best.craziness - a.best.craziness).map((c, i) => (
              <tr key={c.id}>
                <td className="num">{i + 1}</td>
                <td>{champCell(c.id)}</td>
                <td><BuildCell b={c.best} champ={c.id} /></td>
                <td className="num big">{toScore(c.best.craziness).toFixed(0)}</td>
                <td className="num small">{c.best.axes.g.toFixed(0)} / {c.best.axes.c.toFixed(0)} / {c.best.axes.f.toFixed(0)}</td>
                <td className="num small"><Odds p={c.best.probability} /></td>
                <td className="num">{toScore(c.expected).toFixed(0)}</td>
                <td><ItemsRow bb={c.best.items} /></td>
                <td><button className="btn" onClick={() => open(c.id, c.best)}>{t(loc, "open")}</button></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
