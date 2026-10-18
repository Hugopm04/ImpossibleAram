// Live mode (D20): enter the cards offered on the current screen (and reroll results); get the
// pick and "reroll this card?" advice. A card's reroll value is the expected score of a random
// replacement of the same rarity from the remaining eligible pool (cards already seen excluded).
import { useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx } from "../i18n";
import { rankCandidates, oddsCtx, sortValue, type Candidate } from "../engine/search";
import { nextStage, pool } from "../engine/odds";
import { bestBuild } from "../engine/items";
import { toScore } from "../engine/score";
import { AugIcon, AugmentRef, RarityBadge } from "../components/cards";
import { ChampionPicker, ItemsRow, Odds, emptyBuild, useBestBuilds, useDeferredCompute, useEngineCtx } from "./common";
import { BuildPanel } from "./BuildPanel";

export function Live() {
  const { data, build, setBuild, loc, settings } = useApp();
  const ctx = useEngineCtx();
  const [offered, setOffered] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const bbs = useBestBuilds(ctx, build);
  const items = bbs?.free.items ?? [];
  const stage = build ? nextStage(build) : 1;
  const rows = useDeferredCompute<Candidate[]>(
    () => (ctx && build && stage <= 4 ? rankCandidates(ctx, build, { items }) : []),
    [ctx, build, items.join(","), settings.sortBy],
  );
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.aug.id, r])), [rows]);
  if (!data) return null;
  if (!build || !ctx) return <ChampionPicker onPick={(c) => setBuild(emptyBuild(c.id))} />;

  const key = settings.sortBy;
  const offeredRows = offered.map((id) => byId.get(id)).filter(Boolean) as Candidate[];
  const bestOffered = offeredRows.slice().sort((a, b) => sortValue(b, key) - sortValue(a, key))[0];
  const seen = new Set(offered);
  const rerollValue = (c: Candidate) => {
    const repl = pool(oddsCtx(ctx), build, stage, c.aug.rarity, seen).map((a) => byId.get(a.id)).filter(Boolean) as Candidate[];
    if (!repl.length) return 0;
    return repl.reduce((s, r) => s + sortValue(r, key), 0) / repl.length;
  };
  const matches = q.length >= 2 && rows
    ? rows.filter((r) => !seen.has(r.aug.id) && tx(loc, r.aug.name).toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : [];
  const take = (c: Candidate) => {
    setBuild({ ...build, picks: [...build.picks, { aug: c.aug.id, stage: c.stage, slot: c.slot }] });
    setOffered([]);
  };

  return (
    <div className="grid-planner">
      <BuildPanel ctx={ctx} build={build} />
      <div className="panel">
        <h2>{stage <= 4 ? `${t(loc, "screen")} ${stage} · ${t(loc, "offered")}` : t(loc, "fullBuild")}</h2>
        {stage <= 4 && (
          <>
            <input className="input" placeholder={t(loc, "addOffered")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 320 }} />
            {matches.length > 0 && (
              <div className="search-results" style={{ maxWidth: 420 }}>
                {matches.map((r) => (
                  <div key={r.aug.id} onClick={() => { setOffered([...offered, r.aug.id].slice(-6)); setQ(""); }}>
                    <AugIcon aug={r.aug} /> {tx(loc, r.aug.name)} <RarityBadge rarity={r.aug.rarity} loc={loc} />
                  </div>
                ))}
              </div>
            )}
            {rows == null && <div className="spinner">{t(loc, "computing")}</div>}
            <div className="offer-grid" style={{ marginTop: 12 }}>
              {offeredRows.map((c) => {
                const rv = rerollValue(c);
                const shouldReroll = rv > sortValue(c, key) && c !== bestOffered;
                return (
                  <div key={c.aug.id} className={`offer${c === bestOffered ? " best" : ""}`}>
                    <div className="row">
                      <AugIcon aug={c.aug} />
                      <div>
                        <div className="augname"><AugmentRef id={c.aug.id} champ={ctx.champ} slot={c.slot} /></div>
                        <RarityBadge rarity={c.aug.rarity} loc={loc} />
                      </div>
                      <button className="x" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                        onClick={() => setOffered(offered.filter((x) => x !== c.aug.id))}>✕</button>
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>
                      {t(loc, "now")} <b>{toScore(c.now).toFixed(0)}</b> · {t(loc, "best")} <b>{toScore(c.best).toFixed(0)}</b> · {t(loc, "expected")} <b>{toScore(c.expected).toFixed(0)}</b>
                    </div>
                    <div className="small muted">{t(loc, "pNext")} <Odds p={c.pNext} /> · {t(loc, "rerollValue")} {toScore(rv).toFixed(0)}</div>
                    <div className="small" style={{ margin: "4px 0" }}><ItemsRow bb={bestBuild(ctx, { ...build, picks: [...build.picks, { aug: c.aug.id, stage: c.stage, slot: c.slot }] }).items} /></div>
                    <div className="row" style={{ marginTop: 6 }}>
                      {c === bestOffered ? <button className="btn primary" onClick={() => take(c)}>{t(loc, "takeThis")}</button>
                        : <button className="btn" onClick={() => take(c)}>{t(loc, "pick")}</button>}
                      <span className="small" style={{ color: shouldReroll ? "var(--blue)" : "var(--text-dim)" }}>
                        {t(loc, "reroll")} {shouldReroll ? t(loc, "rerollYes") : t(loc, "rerollNo")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
