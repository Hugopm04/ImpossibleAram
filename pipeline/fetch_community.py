"""Download community statistics for the current patch into data/raw/<version>/community/.

Usage:  python -I pipeline/fetch_community.py [--force] [--no-single]

Source 1, ARAMKit (aramkit.com, static files on data.aramkit.com; data path read from the
site's Nuxt config so it follows new patches):
  - stats/all/augment-rarity.json              rarity odds per stage + stage transitions
  - stats/all/augment-rankings.json            global augment stats
  - stats/all/champion-rankings.json           champion stats
  - stats/all/champion-details/<key>.json      per champion: augments (all + per stage) with
                                               win rate / pick rate / samples, top augment
                                               pairs, items, build archetypes
  - stats/all/champion-details/<key>-single-augments.json
                                               per champion and augment: items / builds
                                               (~1.2 MB compressed each; skip with --no-single)
Source 2, u.gg's public static ARAM: Mayhem files on static.bigbrain.gg:
  - aram-mayhem-augment-manifest-<patch>.json   platform augment id -> name
  - tierlist-champions-<patch>.json             champion tiers
  - tierlist-augments-<championKey>-<patch>.json augments observed per champion, by rarity,
                                                 ordered best tier first
The per-champion lists are the empirical basis for champion eligibility (see CLAUDE.md D17).
Requests are sequential with a short pause to stay polite.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with `python -I`: own folder only
from common import current_raw_dir, download, http_get, load_json

BASE = "https://static.bigbrain.gg/custom-aram-mayhem"
AK_SITE = "https://aramkit.com/en-US"
AK_DATA = "https://data.aramkit.com"


def aramkit(raw: Path, force: bool, single: bool) -> None:
    game = raw.name.split(".")
    version = f"{game[0]}.{game[1]}"
    html = http_get(AK_SITE).decode("utf-8", "replace")
    m = re.search(r'\{version:"' + re.escape(version) + r'",dataPath:"([^"]+)"', html)
    if not m:
        print(f"ARAMKit: no data for {version} yet (skipped)")
        return
    base = f"{AK_DATA}/{m.group(1)}/stats/all"
    out = raw / "community" / "aramkit"
    (out).mkdir(parents=True, exist_ok=True)
    (out / "DATAPATH.txt").write_text(m.group(1), encoding="utf-8")
    for name in ("augment-rarity.json", "augment-rankings.json", "champion-rankings.json"):
        download(f"{base}/{name}", out / name, force)
    champs = [c for c in load_json(raw / "plugin" / "champion-summary.json") if 0 < c["id"] < 1000]
    missing = []
    for c in champs:
        names = [f"{c['id']}.json"] + ([f"{c['id']}-single-augments.json"] if single else [])
        for n in names:
            dest = out / "champions" / n
            if dest.exists() and not force:
                continue
            try:
                download(f"{base}/champion-details/{n}", dest, force)
            except Exception as e:
                missing.append((c["alias"], n, str(e)[:80]))
            time.sleep(0.1)
    print(f"ARAMKit {version}: {len(champs)} champions, {len(missing)} files missing")
    for mm in missing:
        print("  missing", *mm)


def main(force: bool = False, single: bool = True) -> None:
    raw = current_raw_dir()
    aramkit(raw, force, single)
    game = raw.name.split(".")
    patch = f"{game[0]}_{game[1]}"
    out = raw / "community" / "ugg"
    download(f"{BASE}/{patch}/aram-mayhem-augment-manifest-{patch}.json", out / "manifest.json", force)
    download(f"{BASE}/{patch}/tierlist-champions-{patch}.json", out / "tierlist-champions.json", force)
    champs = [c for c in load_json(raw / "plugin" / "champion-summary.json") if 0 < c["id"] < 1000]
    missing = []
    for c in champs:
        dest = out / "augments" / f"{c['id']}.json"
        if dest.exists() and not force:
            continue
        try:
            download(f"{BASE}/{patch}/tierlist-per-champion-augments-rarity-{patch}/"
                     f"tierlist-augments-{c['id']}-{patch}.json", dest, force)
        except Exception as e:
            missing.append((c["alias"], str(e)[:80]))
        time.sleep(0.15)
    print(f"u.gg: {len(champs) - len(missing)} champions ok, {len(missing)} missing")
    for m in missing:
        print("  missing", *m)


if __name__ == "__main__":
    main(force="--force" in sys.argv, single="--no-single" not in sys.argv)
