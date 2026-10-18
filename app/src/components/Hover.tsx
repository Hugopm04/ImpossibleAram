// Nested hover cards (D22). <HoverRef render={...}> opens a card next to its trigger after a
// short delay; references inside a card open child cards (chainable). Clicking a trigger or a
// card pins it; pinned cards stay until closed with ✕. Cards close when the pointer leaves the
// trigger, the card and all its children.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface CardState {
  id: number;
  level: number;
  render: () => ReactNode;
  anchor: DOMRect;
  pinned: boolean;
  key: string;
}

interface HoverApi {
  open: (level: number, key: string, anchor: DOMRect, render: () => ReactNode, pin?: boolean) => number;
  scheduleClose: (id: number) => void;
  keep: (id: number) => void;
  pin: (id: number) => void;
  close: (id: number) => void;
}

const HoverCtx = createContext<HoverApi | null>(null);
const LevelCtx = createContext<{ level: number; cardId: number | null }>({ level: 0, cardId: null });

export function HoverProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<CardState[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);
  const hovered = useRef(new Set<number>());

  const clearTimer = (id: number) => {
    const t = timers.current.get(id);
    if (t) { window.clearTimeout(t); timers.current.delete(id); }
  };

  const cardsRef = useRef<CardState[]>([]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  const open = useCallback<HoverApi["open"]>((level, key, anchor, render, pin = false) => {
    const existing = cardsRef.current.find((c) => c.level === level && c.key === key);
    if (existing) {
      clearTimer(existing.id);
      if (pin) setCards((cs) => cs.map((c) => (c.id === existing.id ? { ...c, pinned: true } : c)));
      return existing.id;
    }
    const id = nextId.current++;
    // replace unpinned cards at this level and deeper
    setCards((cs) => [...cs.filter((c) => c.level < level || c.pinned), { id, level, render, anchor, pinned: pin, key }]);
    return id;
  }, []);

  const close = useCallback((id: number) => {
    clearTimer(id);
    setCards((cs) => {
      const target = cs.find((c) => c.id === id);
      if (!target) return cs;
      return cs.filter((c) => c.id !== id && !(c.level > target.level && !c.pinned));
    });
  }, []);

  const scheduleClose = useCallback((id: number) => {
    clearTimer(id);
    timers.current.set(id, window.setTimeout(() => {
      setCards((cs) => {
        const me = cs.find((c) => c.id === id);
        if (!me || me.pinned || hovered.current.has(id)) return cs;
        const childHovered = cs.some((c) => c.level > me.level && hovered.current.has(c.id));
        if (childHovered) return cs;
        return cs.filter((c) => c.id !== id && !(c.level > me.level && !c.pinned));
      });
    }, 220));
  }, []);

  const keep = useCallback((id: number) => clearTimer(id), []);
  const pin = useCallback((id: number) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: true } : c))), []);

  const api: HoverApi = { open, scheduleClose, keep, pin, close };
  return (
    <HoverCtx.Provider value={api}>
      {children}
      {createPortal(
        cards.map((c) => (
          <CardView key={c.id} card={c} api={api} cards={cards}
            onEnter={() => { hovered.current.add(c.id); keep(c.id); cards.filter((p) => p.level < c.level).forEach((p) => keep(p.id)); }}
            onLeave={() => { hovered.current.delete(c.id); scheduleClose(c.id); cards.filter((p) => p.level < c.level).forEach((p) => scheduleClose(p.id)); }}
          />
        )),
        document.body,
      )}
    </HoverCtx.Provider>
  );
}

function CardView({ card, api, onEnter, onLeave }: {
  card: CardState; api: HoverApi; cards: CardState[]; onEnter: () => void; onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const a = card.anchor;
    let left = a.right + 10;
    if (left + w > window.innerWidth - 8) left = a.left - w - 10;
    if (left < 8) left = Math.max(8, Math.min(window.innerWidth - w - 8, a.left));
    let top = a.top - 6;
    if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [card.anchor]);
  return (
    <div ref={ref} className={`card${card.pinned ? " pinned" : ""}`} style={{ left: pos.left, top: pos.top }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={(e) => { e.stopPropagation(); api.pin(card.id); }}>
      <div className="card-actions">
        {card.pinned && <button title="close" onClick={(e) => { e.stopPropagation(); api.close(card.id); }}>✕</button>}
      </div>
      <LevelCtx.Provider value={{ level: card.level + 1, cardId: card.id }}>{card.render()}</LevelCtx.Provider>
    </div>
  );
}

export function HoverRef({ children, render, className, hoverKey }: {
  children: ReactNode; render: () => ReactNode; className?: string; hoverKey: string;
}) {
  const api = useContext(HoverCtx);
  const { level } = useContext(LevelCtx);
  const ref = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | null>(null);
  const cardId = useRef<number | null>(null);
  if (!api) return <>{children}</>;
  const doOpen = (pin: boolean) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    cardId.current = api.open(level, hoverKey, rect, render, pin);
  };
  return (
    <span ref={ref} className={className}
      onMouseEnter={() => { openTimer.current = window.setTimeout(() => doOpen(false), 130); }}
      onMouseLeave={() => {
        if (openTimer.current) window.clearTimeout(openTimer.current);
        window.setTimeout(() => { if (cardId.current) api.scheduleClose(cardId.current); }, 0);
      }}
      onClick={(e) => { e.stopPropagation(); doOpen(true); }}>
      {children}
    </span>
  );
}
