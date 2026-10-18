import { useApp, type View } from "./state";
import { t } from "./i18n";
import { Planner } from "./views/Planner";
import { Live } from "./views/Live";
import { Encyclopedia } from "./views/Encyclopedia";
import { Leaderboard } from "./views/Leaderboard";
import { SettingsView } from "./views/Settings";

const VIEWS: { key: View; label: "planner" | "live" | "encyclopedia" | "leaderboard" | "ceilings" | "settings" }[] = [
  { key: "planner", label: "planner" },
  { key: "live", label: "live" },
  { key: "encyclopedia", label: "encyclopedia" },
  { key: "leaderboard", label: "leaderboard" },
  { key: "ceilings", label: "ceilings" },
  { key: "settings", label: "settings" },
];

export function App() {
  const { data, error, view, setView, loc, setSettings } = useApp();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Impossible ARAM<small>{t(loc, "appSub")}{data ? ` · ${data.meta.patch}` : ""}</small></div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <button key={v.key} className={view === v.key ? "active" : ""} onClick={() => setView(v.key)}>{t(loc, v.label)}</button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="lang">
          <button className={loc === "en" ? "active" : ""} onClick={() => setSettings({ locale: "en" })}>EN</button>
          <button className={loc === "es" ? "active" : ""} onClick={() => setSettings({ locale: "es" })}>ES</button>
        </div>
      </header>
      <main className="main">
        {error && <div className="panel warn">{error}</div>}
        {!data && !error && <div className="spinner">{t(loc, "loading")}</div>}
        {data && view === "planner" && <Planner />}
        {data && view === "live" && <Live />}
        {data && view === "encyclopedia" && <Encyclopedia />}
        {data && view === "leaderboard" && <Leaderboard mode="combos" />}
        {data && view === "ceilings" && <Leaderboard mode="ceilings" />}
        {data && view === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
