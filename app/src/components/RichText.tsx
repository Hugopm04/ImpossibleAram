// Renders Riot tooltip markup (<magicDamage>, <scaleAP>, <br>, %i icons...) as React, safely:
// the string is parsed with DOMParser and only text plus a styling class per tag is kept.
// `links` turns matching words inside text nodes into nested hover references.
import { Fragment, type ReactNode } from "react";

export interface TextLink { text: string; render: (label: string, key: string) => ReactNode }

const CLASS_FOR: Record<string, string> = {
  magicdamage: "magicDamage", physicaldamage: "physicalDamage", truedamage: "trueDamage",
  scaleap: "scaleAP", scalead: "scaleAD", scalehealth: "scaleHealth", healing: "healing", health: "health",
  scalearmor: "scaleArmor", scalemr: "scaleMR", shield: "shield", speed: "speed", scalems: "scaleMS",
  attackspeed: "attackSpeed", scaleas: "scaleAS", status: "status", keyword: "keyword", keywordmajor: "keywordMajor",
  attention: "attention", spellname: "spellName", rules: "rules", flavortext: "flavorText", lifesteal: "lifeSteal",
  scalecrit: "scaleCrit", scalehaste: "scaleHaste", scaleah: "scaleAH", unknown: "unknown", spellref: "spellRef",
  onhit: "keyword", recast: "keyword", scaleaf: "scaleAD", scaleother: "keyword", scalemana: "scaleMR",
  scalelifesteal: "lifeSteal", maintext: "", titleleft: "keyword", stats: "",
};

let parser: DOMParser | null = null;

export function RichText({ html, links = [], spellRef }: { html: string; links?: TextLink[]; spellRef?: ReactNode }) {
  if (typeof window === "undefined") return <span>{html}</span>;
  parser ??= new DOMParser();
  const doc = parser.parseFromString(`<body>${html ?? ""}</body>`, "text/html");
  const sorted = [...links].filter((l) => l.text.length >= 3).sort((a, b) => b.text.length - a.text.length);
  const re = sorted.length ? new RegExp(`(${sorted.map((l) => escapeRe(l.text)).join("|")})`, "g") : null;
  let k = 0;
  const used = new Set<string>();
  const walk = (node: Node): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!re) return text;
      const parts = text.split(re);
      return parts.map((p) => {
        const link = sorted.find((l) => l.text === p);
        if (link && !used.has(p)) {
          used.add(p);
          return <Fragment key={k++}>{link.render(p, `l${k}`)}</Fragment>;
        }
        return p;
      });
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") return <br key={k++} />;
    if (tag === "i" && el.getAttribute("data-icon")) return <span key={k++} className="icon" />;
    if (tag === "spellref") return <span key={k++} className="spellRef">{spellRef ?? "[ability]"}</span>;
    const children = Array.from(el.childNodes).map((c, i) => <Fragment key={i}>{walk(c)}</Fragment>);
    if (tag === "font") {
      const color = el.getAttribute("color") ?? undefined;
      return <span key={k++} style={{ color }}>{children}</span>;
    }
    if (tag === "li") return <div key={k++}>• {children}</div>;
    const cls = CLASS_FOR[tag] ?? tag;
    return <span key={k++} className={cls}>{children}</span>;
  };
  return <span className="rich">{Array.from(doc.body.childNodes).map((n, i) => <Fragment key={i}>{walk(n)}</Fragment>)}</span>;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function plain(html: string): string {
  return (html ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
