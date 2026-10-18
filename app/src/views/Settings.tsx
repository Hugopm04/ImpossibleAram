import { useApp } from "../state";
import { t } from "../i18n";
import { DEFAULT_SETTINGS } from "../engine/settings";

export function WeightSliders() {
  const { settings, setSettings, loc } = useApp();
  const w = settings.weights;
  const set = (k: "g" | "c" | "f", v: number) => setSettings({ weights: { ...w, [k]: v } });
  const row = (k: "g" | "c" | "f", label: string) => (
    <div className="slider" key={k}>
      <span style={{ color: `var(--${k})` }}>{label}</span>
      <input type="range" min={0} max={100} step={1} value={w[k]} onChange={(e) => set(k, Number(e.target.value))} />
      <span className="num">{Math.round(w[k])}</span>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <h3>{t(loc, "weights")}</h3>
      {row("g", t(loc, "G"))}
      {row("c", t(loc, "C"))}
      {row("f", t(loc, "F"))}
    </div>
  );
}

export function SettingsView() {
  const { settings, setSettings, loc } = useApp();
  return (
    <div className="panel" style={{ maxWidth: 620, display: "grid", gap: 14 }}>
      <h2>{t(loc, "settings")}</h2>
      <WeightSliders />
      <div className="slider">
        <span>{t(loc, "aTerm")}</span>
        <input type="range" min={0} max={3} step={0.1} value={settings.a} onChange={(e) => setSettings({ a: Number(e.target.value) })} />
        <span className="num">{settings.a.toFixed(1)}</span>
      </div>
      <div className="slider">
        <span>{t(loc, "bTerm")}</span>
        <input type="range" min={0} max={2} step={0.1} value={settings.b} onChange={(e) => setSettings({ b: Number(e.target.value) })} />
        <span className="num">{settings.b.toFixed(1)}</span>
      </div>
      <div className="slider" title={t(loc, "milestoneTip")}>
        <span>{t(loc, "milestone")}</span>
        <input type="range" min={0} max={32} step={1} value={settings.milestone} onChange={(e) => setSettings({ milestone: Number(e.target.value) })} />
        <span className="num">{settings.milestone}</span>
      </div>
      <div className="small muted">{t(loc, "milestoneTip")}</div>
      <div className="row">
        <span>{t(loc, "language")}</span>
        <button className={`btn${loc === "en" ? " primary" : ""}`} onClick={() => setSettings({ locale: "en" })}>English</button>
        <button className={`btn${loc === "es" ? " primary" : ""}`} onClick={() => setSettings({ locale: "es" })}>Español</button>
      </div>
      <div><button className="btn ghost" onClick={() => setSettings({ ...DEFAULT_SETTINGS, locale: loc })}>{t(loc, "reset")}</button></div>
    </div>
  );
}
