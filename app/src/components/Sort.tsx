// Sortable headers (D54): every sortable header looks like a button with ⇅; the active one shows
// ▼/▲ in gold. Clicking the active header again flips the direction. Non-sortable headers stay
// plain text, so the difference is visible.
import { useState, type ReactNode } from "react";

export type Dir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: Dir;
  set: (k: K) => void;
}

/** Local sort state. Keys in `ascKeys` start ascending on first click (names); the rest start descending (scores). */
export function useSort<K extends string>(initial: K, ascKeys: readonly K[] = []): SortState<K> {
  const natural = (k: K): Dir => (ascKeys.includes(k) ? "asc" : "desc");
  const [state, setState] = useState<{ key: K; dir: Dir }>({ key: initial, dir: natural(initial) });
  return {
    ...state,
    set: (k) => setState((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: natural(k) })),
  };
}

/** Wrap an ascending comparator so it follows the sort direction. */
export function directed<T>(dir: Dir, ascending: (a: T, b: T) => number): (a: T, b: T) => number {
  return dir === "asc" ? ascending : (a, b) => ascending(b, a);
}

function Arrow({ active, dir }: { active: boolean; dir: Dir }) {
  return <span className="arrow">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>;
}

export function SortTh<K extends string>({ k, sort, children, title }: {
  k: K; sort: SortState<K>; children: ReactNode; title?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={`sortable${active ? " sorted" : ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" title={title} onClick={() => sort.set(k)}>
        {children}<Arrow active={active} dir={sort.dir} />
      </button>
    </th>
  );
}

/** The same affordance as a row of buttons, for lists that are not tables (champion grid). */
export function SortBar<K extends string>({ sort, options, label }: {
  sort: SortState<K>; options: { k: K; label: ReactNode }[]; label?: ReactNode;
}) {
  return (
    <div className="sortbar">
      {label && <span className="muted small">{label}</span>}
      {options.map((o) => {
        const active = sort.key === o.k;
        return (
          <button key={o.k} type="button" className={`sortbtn${active ? " sorted" : ""}`} onClick={() => sort.set(o.k)}>
            {o.label}<Arrow active={active} dir={sort.dir} />
          </button>
        );
      })}
    </div>
  );
}
