import type { ReactNode } from "react";
import { HoverRef } from "./Hover";
import { RichText, type TextLink } from "./RichText";
import { useApp } from "../state";
import { t, tx, TYPE_NAMES } from "../i18n";
import type { Ability, Anvil, Augment, Champion, Item, Loc, Rarity, Slot } from "../engine/types";

export function RarityBadge({ rarity, loc }: { rarity: Rarity; loc: Loc }) {
  return <span className={`rar-badge rar-${rarity}`}>{t(loc, rarity)}</span>;
}

export function AugIcon({ aug }: { aug: Augment }) {
  return <span className={`rar-${aug.rarity}`}><img className="aug-icon" src={aug.icon ?? ""} alt="" loading="lazy" /></span>;
}

// ---------------------------------------------------------------- references

export function ItemRef({ id, children, icon }: { id: string; children?: ReactNode; icon?: boolean }) {
  const { data, loc } = useApp();
  const item = data?.itemById.get(id);
  if (!item) return <>{children}</>;
  return (
    <HoverRef hoverKey={`item:${id}`} className="hover-ref item" render={() => <ItemCard item={item} />}>
      {icon ? <img className="item-icon" src={item.icon} alt={tx(loc, item.name)} /> : children ?? tx(loc, item.name)}
    </HoverRef>
  );
}

export function AbilityRef({ champ, slot, children }: { champ: Champion; slot: Slot; children?: ReactNode }) {
  const { loc } = useApp();
  const ab = champ.abilities.find((a) => a.slot === slot);
  if (!ab) return <>{children}</>;
  return (
    <HoverRef hoverKey={`ab:${champ.id}:${slot}`} className="hover-ref ability" render={() => <AbilityCard champ={champ} ability={ab} />}>
      {children ?? tx(loc, ab.name)}
    </HoverRef>
  );
}

export function AugmentRef({ id, children, champ, slot }: { id: string; children?: ReactNode; champ?: Champion | null; slot?: Slot }) {
  const { data, loc } = useApp();
  const aug = data?.augmentById.get(id);
  if (!aug) return <>{children}</>;
  return (
    <HoverRef hoverKey={`aug:${id}`} className="hover-ref augment" render={() => <AugmentCard aug={aug} champ={champ ?? null} slot={slot} />}>
      {children ?? tx(loc, aug.name)}
    </HoverRef>
  );
}

// ---------------------------------------------------------------- cards

function itemLinks(itemIds: string[], loc: Loc, items: Map<string, Item>): TextLink[] {
  return itemIds.map((id) => items.get(id)).filter(Boolean).map((it) => ({
    text: tx(loc, it!.name),
    render: (label: string) => <ItemRef id={it!.id}>{label}</ItemRef>,
  }));
}

const ULT_WORDS: Record<Loc, string[]> = { en: ["Ultimate"], es: ["definitiva", "Definitiva"] };

export function AugmentCard({ aug, champ, slot }: { aug: Augment; champ: Champion | null; slot?: Slot }) {
  const { data, loc, stats } = useApp();
  if (!data) return null;
  const links: TextLink[] = itemLinks(aug.linkedItems, loc, data.itemById);
  if (champ) {
    for (const w of ULT_WORDS[loc]) links.push({ text: w, render: (label) => <AbilityRef champ={champ} slot="R">{label}</AbilityRef> });
  }
  const chosenSlot = slot ?? (aug.isAbility && champ ? (champ.abilityAugmentSlots[aug.id] ?? [])[0] : undefined);
  const spellRef = champ && chosenSlot ? <AbilityRef champ={champ} slot={chosenSlot} /> : undefined;
  const granted = aug.grantsAbilities.map((g) => {
    const [cid, s] = g.split(":");
    return { champ: data.championById.get(cid), slot: (s === "P" ? "P" : s) as Slot };
  }).filter((x) => x.champ);
  const wrHere = champ && stats?.wr?.[aug.id];
  const elig = champ && stats ? stats.eligible[aug.id] : undefined;
  return (
    <div className={`rar-${aug.rarity}`}>
      <div className="card-head">
        <img src={aug.icon ?? ""} alt="" />
        <div>
          <div className="card-title">{tx(loc, aug.name)}</div>
          <div className="row" style={{ gap: 6 }}>
            <RarityBadge rarity={aug.rarity} loc={loc} />
            {aug.type && <span className="typechip">{tx(loc, TYPE_NAMES[aug.type])}</span>}
            {aug.isAbility && <span className="tagchip">{t(loc, "ability")}</span>}
            {!aug.enabled && <span className="tagchip">disabled</span>}
          </div>
        </div>
      </div>
      <div><RichText html={tx(loc, aug.tooltip)} links={links} spellRef={spellRef} /></div>
      {aug.quest && (
        <div className="card-section">
          <b>{t(loc, "quest")}:</b>
          {aug.quest.milestones.map((m, i) => (
            <div key={i} className="small"><RichText html={tx(loc, m.text)} links={links} spellRef={spellRef} /></div>
          ))}
        </div>
      )}
      {aug.isAbility && champ && (
        <div className="card-section small">
          {t(loc, "attachesTo")}: {(champ.abilityAugmentSlots[aug.id] ?? []).map((s) => (
            <span key={s} style={{ marginRight: 8 }}><AbilityRef champ={champ} slot={s}>{s} · {tx(loc, champ.abilities.find((a) => a.slot === s)?.name)}</AbilityRef></span>
          ))}
        </div>
      )}
      {granted.length > 0 && (
        <div className="card-section small">
          {t(loc, "grants")}: {granted.map((g) => (
            <span key={`${g.champ!.id}${g.slot}`} style={{ marginRight: 8 }}>
              <AbilityRef champ={g.champ!} slot={g.slot}>{tx(loc, g.champ!.name)} {g.slot}</AbilityRef>
            </span>
          ))}
        </div>
      )}
      {aug.linkedItems.length > 0 && (
        <div className="card-section small row">{t(loc, "linkedItems")}: {aug.linkedItems.map((id) => <ItemRef key={id} id={id} icon />)}</div>
      )}
      {champ && aug.abilityRefs.length > 0 && !aug.isAbility && (
        <div className="card-section small">
          {t(loc, "linkedAbilities")}: {aug.abilityRefs.map((s) => (
            <span key={s} style={{ marginRight: 8 }}><AbilityRef champ={champ} slot={s}>{s} · {tx(loc, champ.abilities.find((a) => a.slot === s)?.name)}</AbilityRef></span>
          ))}
        </div>
      )}
      <div className="card-section small muted">
        <div>{t(loc, "potential")}: <span style={{ color: "var(--g)" }}>G {aug.cur.g}</span> · <span style={{ color: "var(--c)" }}>C {aug.cur.c}</span> · <span style={{ color: "var(--f)" }}>F {aug.cur.f}</span> · {t(loc, "power")} ×{aug.cur.p.toFixed(2)}</div>
        <div>{t(loc, "eligibleFor")} {aug.eligibleCount} {t(loc, "champions")} · {t(loc, "stages")}: {(elig ?? aug.stages).join(", ")}</div>
        {aug.global && <div>{t(loc, "globalWr")}: {(aug.global.winRate * 100).toFixed(1)}% ({aug.global.samples.toLocaleString()} {t(loc, "games")})</div>}
        {wrHere && <div>{t(loc, "wrHere")}: {(wrHere[0] * 100).toFixed(1)}% ({wrHere[2].toLocaleString()} {t(loc, "games")})</div>}
        {aug.trackMilestone && <div>{t(loc, "locked")}: {aug.trackMilestone}</div>}
        <div style={{ marginTop: 4 }}>{aug.cur.t.slice(0, 14).map((x) => <span key={x} className="tagchip">{x}</span>)}</div>
      </div>
    </div>
  );
}

export function ItemCard({ item }: { item: Item }) {
  const { loc } = useApp();
  return (
    <div>
      <div className="card-head">
        <img src={item.icon} alt="" />
        <div>
          <div className="card-title">{tx(loc, item.name)}</div>
          <div className="card-sub">{item.gold.total ? `${item.gold.total} g` : ""} {item.special ? "· Mayhem" : ""}</div>
        </div>
      </div>
      <RichText html={tx(loc, item.description)} />
      {(item.from.length > 0 || item.into.length > 0) && (
        <div className="card-section small row">
          {item.from.length > 0 && <span>← {item.from.map((id, i) => <ItemRef key={`${id}${i}`} id={id} icon />)}</span>}
          {item.into.length > 0 && <span>→ {item.into.slice(0, 8).map((id) => <ItemRef key={id} id={id} icon />)}</span>}
        </div>
      )}
      {item.cur.t.length > 0 && <div className="card-section">{item.cur.t.filter((x) => !x.startsWith("gives:") && x !== "item:any").map((x) => <span key={x} className="tagchip">{x}</span>)}</div>}
    </div>
  );
}

export function AbilityCard({ champ, ability }: { champ: Champion; ability: Ability }) {
  const { loc } = useApp();
  return (
    <div>
      <div className="card-head">
        <img src={ability.icon ?? ""} alt="" />
        <div>
          <div className="card-title">{tx(loc, ability.name)}</div>
          <div className="card-sub">{tx(loc, champ.name)} · {ability.slot === "P" ? "Passive" : ability.slot}
            {ability.cooldown && ` · ${t(loc, "cooldown")} ${ability.cooldown}s`}{ability.cost && ` · ${t(loc, "cost")} ${ability.cost}`}</div>
        </div>
      </div>
      <RichText html={tx(loc, ability.tooltip)} />
    </div>
  );
}

export function AnvilCard({ anvil, tier }: { anvil: Anvil; tier: Rarity }) {
  const { loc } = useApp();
  return (
    <div className={`rar-${tier}`}>
      <div className="card-head">
        <img src={anvil.icon ?? ""} alt="" />
        <div>
          <div className="card-title">{tx(loc, anvil.name)}</div>
          <RarityBadge rarity={tier} loc={loc} />
        </div>
      </div>
      <RichText html={tx(loc, anvil.tooltip)} />
    </div>
  );
}
