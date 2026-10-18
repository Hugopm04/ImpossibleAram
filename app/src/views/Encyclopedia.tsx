// Augment encyclopedia (D21): every augment with filters (rarity, type, tag, text, enabled).
import { useMemo, useState } from "react";
import { useApp } from "../state";
import { t, tx, TYPE_NAMES } from "../i18n";
import type { Rarity } from "../engine/types";
import { AugIcon, AugmentRef, RarityBadge } from "../components/cards";
import { plain } from "../components/RichText";

type SortKey = "name" | "rarity" | "g" | "c" | "f" | "wr" | "elig";

export function Encyclopedia() {
  const { data, loc, build } = useApp();
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [sort, setSort] = useState<SortKey>("name");
  const champ = build ? data?.championById.get(build.champion) ?? null : null;
  const list = useMemo(() => {
    if (!data) return [];
    const ord: Record<Rarity, number> = { silver: 0, gold: 1, prismatic: 2 };
    return data.augments.filter((a) =>
      (!onlyEnabled || a.enabled) && (rarity === "all" || a.rarity === rarity) && (type === "all" || a.type === type) &&
      (!tag || a.cur.t.some((x) => x.includes(tag))) &&
      (!q || tx(loc, a.name).toLowerCase().includes(q.toLowerCase()) || plain(tx(loc, a.tooltip)).toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => {
        switch (sort) {
          case "rarity": return ord[a.rarity] - ord[b.rarity];
          case "g": return b.cur.g - a.cur.g;
          case "c": return b.cur.c - a.cur.c;
          case "f": return b.cur.f - a.cur.f;
          case "wr": return (b.global?.winRate ?? 0) - (a.global?.winRate ?? 0);
          case "elig": return b.eligibleCount - a.eligibleCount;
          default: return tx(loc, a.name).localeCompare(tx(loc, b.name));
        }
      });
  }, [data, q, rarity, type, tag, onlyEnabled, sort, loc]);
  if (!data) return null;
  const types = [...new Set(data.augments.map((a) => a.type).filter(Boolean))].sort();
  const th = (k: SortKey, label: string) => <th className={sort === k ? "sorted" : ""} onClick={() => setSort(k)}>{label}</th>;
  return (
    <div className="panel">
      <h2>{t(loc, "encyclopedia")} ({list.length})</h2>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input" placeholder={t(loc, "search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        <select className="input" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | "all")}>
          <option value="all">{t(loc, "rarity")}: {t(loc, "all")}</option>
          {(["silver", "gold", "prismatic"] as Rarity[]).map((r) => <option key={r} value={r}>{t(loc, r)}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">{t(loc, "type")}: {t(loc, "all")}</option>
          {types.map((x) => <option key={x} value={x}>{tx(loc, TYPE_NAMES[x])}</option>)}
        </select>
        <input className="input" placeholder="tag (e.g. infinite, on:attack)" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 200 }} />
        <label className="small muted"><input type="checkbox" checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)} /> enabled</label>
      </div>
      <table className="list">
        <thead>
          <tr>{th("name", t(loc, "augment"))}{th("rarity", t(loc, "rarity"))}<th>{t(loc, "type")}</th>
            {th("g", "G")}{th("c", "C")}{th("f", "F")}{th("wr", t(loc, "globalWr"))}{th("elig", t(loc, "eligibleFor"))}<th>{t(loc, "stages")}</th></tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td><div className="augcell"><AugIcon aug={a} /><div><div className="augname"><AugmentRef id={a.id} champ={champ} /></div>
                <div className="small muted" style={{ maxWidth: 520 }}>{plain(tx(loc, a.summary)).slice(0, 140)}</div></div></div></td>
              <td><RarityBadge rarity={a.rarity} loc={loc} /></td>
              <td>{a.type && <span className="typechip">{tx(loc, TYPE_NAMES[a.type])}</span>}</td>
              <td className="num" style={{ color: "var(--g)" }}>{a.cur.g}</td>
              <td className="num" style={{ color: "var(--c)" }}>{a.cur.c}</td>
              <td className="num" style={{ color: "var(--f)" }}>{a.cur.f}</td>
              <td className="num">{a.global ? `${(a.global.winRate * 100).toFixed(1)}%` : "—"}</td>
              <td className="num">{a.eligibleCount}</td>
              <td className="small">{a.stages.join(",")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
