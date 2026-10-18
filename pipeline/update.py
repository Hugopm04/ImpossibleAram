"""One-command patch update (D35).

Usage:  python -I pipeline/update.py [--force] [--no-community] [--no-precompute]

1. snapshots the current app data (augments/champions) for comparison,
2. fetches the raw game data of the current patch (pipeline/fetch.py),
3. fetches community statistics (pipeline/fetch_community.py) unless --no-community,
4. rebuilds the app data (pipeline/build.py),
5. writes a diff report to data/reports/diff-<old>-to-<new>.md listing new/removed augments,
   rarity changes, changed numbers and texts, and augments missing curated entries
   (these need tags + G/C/F in curation/augments.json and a type in curation/taxonomy.json),
6. re-runs the leaderboard precompute (npm run precompute in app/) unless --no-precompute.
Curated files are never modified automatically.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with `python -I`: own folder only
import build
import fetch
import fetch_community
from common import APP_DATA, CURATION, REPORTS, ROOT, load_json


def snapshot() -> dict:
    p = APP_DATA / "augments.json"
    meta = APP_DATA / "meta.json"
    if not p.exists():
        return {"version": None, "augments": {}}
    return {"version": load_json(meta).get("gameVersion") if meta.exists() else None,
            "augments": {a["id"]: a for a in load_json(p)}}


def bullets(items: list[str]) -> list[str]:
    return items or ["- none"]


def diff(old: dict, new: dict) -> str:
    oa, na = old["augments"], new["augments"]
    lines = [f"# Patch diff {old['version']} -> {new['version']}", ""]
    added = sorted(set(na) - set(oa))
    removed = sorted(set(oa) - set(na))
    lines += ["## New augments", *bullets([f"- `{i}` {na[i]['name']['en']} ({na[i]['rarity']})" for i in added]), ""]
    lines += ["## Removed augments", *bullets([f"- `{i}` {oa[i]['name']['en']}" for i in removed]), ""]
    changed = []
    for i in sorted(set(oa) & set(na)):
        a, b = oa[i], na[i]
        notes = []
        if a["rarity"] != b["rarity"]:
            notes.append(f"rarity {a['rarity']} -> {b['rarity']}")
        if a["enabled"] != b["enabled"]:
            notes.append(f"enabled {a['enabled']} -> {b['enabled']}")
        for k in sorted(set(a.get("values", {})) | set(b.get("values", {}))):
            va, vb = a.get("values", {}).get(k), b.get("values", {}).get(k)
            if va != vb:
                notes.append(f"{k}: {va} -> {vb}")
        if a["tooltip"]["en"] != b["tooltip"]["en"]:
            notes.append("tooltip text changed")
        if notes:
            changed.append(f"- `{i}` {b['name']['en']}: " + "; ".join(notes[:8]))
    lines += ["## Changed augments", *bullets(changed), ""]
    cur = load_json(CURATION / "augments.json")["augments"]
    tax = load_json(CURATION / "taxonomy.json")["assignments"]
    missing = [i for i in na if i not in cur or i not in tax]
    lines += ["## Needs curation (tags, G/C/F, type)", *bullets([f"- `{i}` {na[i]['name']['en']}" for i in missing]), ""]
    return "\n".join(lines) + "\n"


def main() -> None:
    args = set(sys.argv[1:])
    old = snapshot()
    fetch.main(force="--force" in args)
    if "--no-community" not in args:
        fetch_community.main(force="--force" in args)
    build.main()
    new = snapshot()
    REPORTS.mkdir(parents=True, exist_ok=True)
    out = REPORTS / f"diff-{old['version']}-to-{new['version']}.md"
    out.write_text(diff(old, new), encoding="utf-8")
    print(f"diff report: {out}")
    if "--no-precompute" not in args:
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run([npm, "run", "precompute"], cwd=ROOT / "app", check=False)
    print(json.dumps({"from": old["version"], "to": new["version"]}))


if __name__ == "__main__":
    main()
