import { useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx } from "../i18n";
import { evaluate, type Ctx } from "../engine/score";
import { nextStage } from "../engine/odds";
import type { Build } from "../engine/types";
import { AbilityRef, AnvilCard, AugIcon, AugmentRef, ItemRef, RarityBadge } from "../components/cards";
import { HoverRef } from "../components/Hover";
import { AxesPanel, BuildLuck, Contributions, ItemsRow, emptyBuild, useBestBuilds } from "./common";
import { FeedbackModal } from "./Feedback";

const LEVELS = [3, 7, 11, 15];

export function BuildPanel({ ctx, build }: { ctx: Ctx; build: Build }) {
  const { loc, setBuild, data } = useApp();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const bbs = useBestBuilds(ctx, build);
  const items = bbs?.locked?.items ?? bbs?.free.items ?? [];
  const ev = useMemo(() => evaluate(ctx, build, items, true), [ctx, build, items]);
  if (!data) return null;
  const champ = ctx.champ;
  const removePick = (i: number) => setBuild({ ...build, picks: build.picks.filter((_, j) => j !== i) });
  const extras = build.picks.map((p, i) => ({ p, i })).filter((x) => x.p.stage === 0);
  const complete = nextStage(build) > 4;
  const itemMatches = itemQuery.length >= 2
    ? data.items.filter((it) => it.inStore && (it.gold.total ?? 0) >= 900 && tx(loc, it.name).toLowerCase().includes(itemQuery.toLowerCase())).slice(0, 12)
    : [];
  return (
    <div className="panel" style={{ display: "grid", gap: 12 }}>
      <div className="champ-head">
        <img src={champ.icon} alt="" />
        <div style={{ flex: 1 }}>
          <div className="name">{tx(loc, champ.name)}</div>
          <div className="small muted">{tx(loc, champ.title)}</div>
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            {champ.abilities.map((a) => (
              <AbilityRef key={a.slot} champ={champ} slot={a.slot}><img className="ability-icon" src={a.icon ?? ""} alt={a.slot} /></AbilityRef>
            ))}
          </div>
        </div>
        <button className="btn ghost" onClick={() => setBuild(null)}>{t(loc, "change")}</button>
      </div>
      {!ctx.stats && <div className="warn">{t(loc, "noStats")}</div>}

      <div className="slots">
        {LEVELS.map((lvl, idx) => {
          const stage = idx + 1;
          const i = build.picks.findIndex((p) => p.stage === stage);
          const pick = i >= 0 ? build.picks[i] : null;
          const aug = pick ? data.augmentById.get(pick.aug) : null;
          return (
            <div key={stage} className={`slot${aug ? " filled" : ""}`}>
              <span className="lvl">{t(loc, "screen")} {stage}<br /><span className="muted">{t(loc, "level")} {lvl}</span></span>
              {aug ? (
                <>
                  <AugIcon aug={aug} />
                  <div>
                    <AugmentRef id={aug.id} champ={champ} slot={pick!.slot} />
                    <div className="row" style={{ gap: 6 }}><RarityBadge rarity={aug.rarity} loc={loc} />{pick!.slot && <span className="small muted">{pick!.slot}</span>}</div>
                  </div>
                  <button className="x" title={t(loc, "remove")} onClick={() => removePick(i)}>✕</button>
                </>
              ) : <span className="muted small">{t(loc, "empty")}</span>}
            </div>
          );
        })}
        {extras.map(({ p, i }) => {
          const aug = data.augmentById.get(p.aug)!;
          return (
            <div key={`x${i}`} className="slot filled">
              <span className="lvl">{t(loc, "extra")}</span>
              <AugIcon aug={aug} />
              <AugmentRef id={aug.id} champ={champ} slot={p.slot} />
              <button className="x" onClick={() => removePick(i)}>✕</button>
            </div>
          );
        })}
      </div>

      <AxesPanel ev={ev} />
      <BuildLuck ctx={ctx} build={build} />
      {ev.warnings.length > 0 && <div>{ev.warnings.map((w) => <div key={w} className="warn">⚠ {w}</div>)}</div>}
      <Contributions ev={ev} ctx={ctx} />

      <div className="card-section">
        <h3>{t(loc, "bestUnconstrained")}</h3>
        {bbs && <ItemsRow bb={bbs.free} />}
        {bbs?.locked && (<><h3 style={{ marginTop: 10 }}>{t(loc, "bestLocked")}</h3><ItemsRow bb={bbs.locked} locked={build.lockedItems} /></>)}
        <div className="small muted" style={{ marginTop: 8 }}>{t(loc, "lockedItems")}</div>
        <div className="row" style={{ gap: 4 }}>
          {build.lockedItems.map((id) => (
            <span key={id} onClick={() => setBuild({ ...build, lockedItems: build.lockedItems.filter((x) => x !== id) })} style={{ cursor: "pointer" }} title={t(loc, "remove")}>
              <ItemRef id={id} icon />
            </span>
          ))}
          <input className="input" placeholder={t(loc, "addItem")} value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} style={{ width: 160 }} />
        </div>
        {itemMatches.length > 0 && (
          <div className="search-results">
            {itemMatches.map((it) => (
              <div key={it.id} onClick={() => { setBuild({ ...build, lockedItems: [...build.lockedItems, it.id].slice(0, 6) }); setItemQuery(""); }}>
                <img className="item-icon" src={it.icon} alt="" /> {tx(loc, it.name)}
              </div>
            ))}
          </div>
        )}
      </div>

      {build.anvils.length > 0 && (
        <div className="card-section">
          <h3>{t(loc, "anvils")}</h3>
          <div className="row" style={{ gap: 6 }}>
            {build.anvils.map((a, i) => {
              const anvil = data.anvils.find((x) => x.id === a.shard);
              return anvil ? (
                <span key={i} className="row" style={{ gap: 4 }}>
                  <HoverRef hoverKey={`anvil:${i}`} className="hover-ref" render={() => <AnvilCard anvil={anvil} tier={a.tier} />}>
                    {tx(loc, anvil.name)} <RarityBadge rarity={a.tier} loc={loc} />
                  </HoverRef>
                  <button className="x" style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                    onClick={() => setBuild({ ...build, anvils: build.anvils.filter((_, j) => j !== i) })}>✕</button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={() => setBuild(emptyBuild(champ.id))}>{t(loc, "reset")}</button>
        <button className="btn primary" disabled={!build.picks.length} onClick={() => setFeedbackOpen(true)}>{complete ? "★ " : ""}{t(loc, "rate")}</button>
        {complete && <span className="small" style={{ color: "var(--blue)" }}>{t(loc, "fullBuild")}</span>}
      </div>
      {feedbackOpen && <FeedbackModal ctx={ctx} build={build} items={items} ev={ev} onClose={() => setFeedbackOpen(false)} />}
      <div className="small muted">{t(loc, "dataFrom")}: patch {data.meta.patch} · CommunityDragon · ARAMKit · u.gg</div>
    </div>
  );
}
