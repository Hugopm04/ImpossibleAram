// Feedback form (D26): overall 1–10, per-axis 1–10 (G/C/F/"did it work"), comment.
// All optional, at least one required. Saved to feedback/ via the dev server and used to
// auto-tune the axis weights (D8). Anvils are not recorded (D13).
import { useState } from "react";
import { useApp } from "../state";
import { t } from "../i18n";
import { autoTune } from "../engine/settings";
import type { Ctx, Evaluation } from "../engine/score";
import type { Build, FeedbackEntry } from "../engine/types";

function Rating({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className="slider">
      <span>{label}</span>
      <input type="range" min={0} max={10} step={1} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || undefined)} />
      <span className="num">{value ?? "—"}</span>
    </div>
  );
}

export function FeedbackModal({ ctx, build, items, ev, onClose }: { ctx: Ctx; build: Build; items: string[]; ev: Evaluation; onClose: () => void }) {
  const { loc, settings, addFeedback, data } = useApp();
  const [overall, setOverall] = useState<number>();
  const [g, setG] = useState<number>();
  const [c, setC] = useState<number>();
  const [f, setF] = useState<number>();
  const [power, setPower] = useState<number>();
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const any = overall != null || g != null || c != null || f != null || power != null || comment.trim().length > 0;
  const submit = async () => {
    const fb: FeedbackEntry = {
      date: new Date().toISOString(),
      champion: ctx.champ.id,
      augments: build.picks.map((p) => ({ id: p.aug, stage: p.stage, slot: p.slot })),
      items,
      overall, axes: { g, c, f, power }, comment: comment.trim() || undefined,
      computed: { craziness: ev.craziness, g: ev.axes.g, c: ev.axes.c, f: ev.axes.f, power: ev.power },
      patch: data?.meta.patch ?? "",
    };
    // compare ratings (1–10) with the model's axes on a comparable 0–10 scale
    const scale = (x: number) => Math.min(10, x / 4);
    const newWeights = g != null || c != null || f != null
      ? autoTune(settings, fb, { g: scale(ev.axes.g), c: scale(ev.axes.c), f: scale(ev.axes.f) })
      : undefined;
    await addFeedback(fb, newWeights);
    setDone(true);
    window.setTimeout(onClose, 900);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t(loc, "feedbackTitle")}</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <Rating label={t(loc, "overall")} value={overall} onChange={setOverall} />
          <Rating label={t(loc, "G")} value={g} onChange={setG} />
          <Rating label={t(loc, "C")} value={c} onChange={setC} />
          <Rating label={t(loc, "F")} value={f} onChange={setF} />
          <Rating label={t(loc, "worked")} value={power} onChange={setPower} />
          <textarea className="input" rows={3} placeholder={t(loc, "comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={!any || done} onClick={submit}>{t(loc, "save")}</button>
          <button className="btn ghost" onClick={onClose}>{t(loc, "cancel")}</button>
          {done && <span className="small" style={{ color: "var(--green)" }}>{t(loc, "saved")}</span>}
        </div>
      </div>
    </div>
  );
}
