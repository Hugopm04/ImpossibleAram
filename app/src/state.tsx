import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browserReader, loadChampStats, loadGameData } from "./engine/data";
import { setScoreReference } from "./engine/score";
import { DEFAULT_SETTINGS, type Tuning } from "./engine/settings";
import type { Build, ChampStats, FeedbackEntry, GameData, Loc, Settings } from "./engine/types";

export type View = "planner" | "live" | "encyclopedia" | "leaderboard" | "ceilings" | "settings";

interface AppState {
  data: GameData | null;
  error: string | null;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  loc: Loc;
  feedback: FeedbackEntry[];
  addFeedback: (fb: FeedbackEntry, newWeights?: Settings["weights"]) => Promise<void>;
  view: View;
  setView: (v: View) => void;
  build: Build | null;
  setBuild: (b: Build | null) => void;
  stats: ChampStats | null;
}

const Ctx = createContext<AppState | null>(null);
const LS_KEY = "impossible-aram-settings";

function loadLocalSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return DEFAULT_SETTINGS;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadLocalSettings);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [view, setView] = useState<View>("planner");
  const [build, setBuild] = useState<Build | null>(null);
  const [stats, setStats] = useState<ChampStats | null>(null);

  useEffect(() => {
    loadGameData(browserReader)
      .then((d) => { setScoreReference(d.leaderboard?.reference); setData(d); })
      .catch((e) => setError(String(e)));
    fetch("/api/feedback").then((r) => (r.ok ? r.json() : [])).then(setFeedback).catch(() => {});
    fetch("/api/tuning").then((r) => (r.ok ? r.json() : {})).then((tun: Tuning) => {
      if (tun.weights) setSettingsState((s) => ({ ...s, weights: tun.weights!, a: tun.a ?? s.a, b: tun.b ?? s.b }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  useEffect(() => {
    setStats(null);
    if (!build?.champion) return;
    let alive = true;
    loadChampStats(browserReader, build.champion).then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [build?.champion]);

  const setSettings = useCallback((s: Partial<Settings>) => setSettingsState((old) => ({ ...old, ...s })), []);

  const addFeedback = useCallback(async (fb: FeedbackEntry, newWeights?: Settings["weights"]) => {
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fb) });
    setFeedback((f) => [...f, fb]);
    if (newWeights) {
      const before = settings.weights;
      setSettingsState((s) => ({ ...s, weights: newWeights }));
      const tuning: Tuning = await fetch("/api/tuning").then((r) => r.json()).catch(() => ({}));
      const history = [...(tuning.history ?? []), { date: fb.date, before, after: newWeights, reason: `feedback on ${fb.champion}` }];
      await fetch("/api/tuning", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tuning, weights: newWeights, a: settings.a, b: settings.b, history }),
      });
    }
  }, [settings]);

  const value = useMemo<AppState>(() => ({
    data, error, settings, setSettings, loc: settings.locale, feedback, addFeedback, view, setView, build, setBuild, stats,
  }), [data, error, settings, setSettings, feedback, addFeedback, view, build, stats]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
