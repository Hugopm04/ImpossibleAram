"""Download the raw game data for the current patch into data/raw/<game version>/.

Usage:  python pipeline/fetch.py [--force]

Sources: CommunityDragon (game bins, string tables, client plugin JSON) and Data Dragon
(items and summoner spells with localized descriptions). Files already present are reused
unless --force is given.
"""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with `python -I`: own folder only
from common import (CDRAGON, CDRAGON_PLUGIN, DDRAGON, LOCALES, RAW_ROOT, download,
                    http_json, load_json)

GAME_BINS = {
    "kiwi.bin.json": "/game/maps/modespecificdata/kiwi.bin.json",
    "aram.bin.json": "/game/maps/modespecificdata/aram.bin.json",
    "abilityaugmentspellmodifiers.bin.json": "/game/maps/modespecificdata/abilityaugmentspellmodifiers.bin.json",
    "map12.bin.json": "/game/data/maps/shipping/map12/map12.bin.json",
    "items.bin.json": "/game/items.cdtb.bin.json",
    "champions.bin.json": "/game/global/champions/champions.bin.json",
}

PLUGIN_DEFAULT = ["augment-lists.json", "cherry-augments.json", "champion-summary.json"]


def main(force: bool = False) -> None:
    meta = http_json(CDRAGON + "/content-metadata.json")
    game_version = meta["version"].split("+")[0]
    dd_version = http_json(DDRAGON + "/api/versions.json")[0]
    raw = RAW_ROOT / game_version
    print(f"game version {game_version}, ddragon {dd_version} -> {raw}")

    jobs: list[tuple[str, object]] = []
    for name, path in GAME_BINS.items():
        jobs.append((CDRAGON + path, raw / "bins" / name))
    for loc, (game_loc, plugin_loc, dd_loc) in LOCALES.items():
        jobs.append((f"{CDRAGON}/game/{game_loc}/data/menu/en_us/lol.stringtable.json",
                     raw / "strings" / f"{loc}.json"))
        jobs.append((f"{DDRAGON}/cdn/{dd_version}/data/{dd_loc}/item.json",
                     raw / "ddragon" / f"item_{loc}.json"))
        jobs.append((f"{DDRAGON}/cdn/{dd_version}/data/{dd_loc}/summoner.json",
                     raw / "ddragon" / f"summoner_{loc}.json"))
    for name in PLUGIN_DEFAULT:
        jobs.append((f"{CDRAGON_PLUGIN}/default/v1/{name}", raw / "plugin" / name))

    run(jobs, force)

    summary = load_json(raw / "plugin" / "champion-summary.json")
    champs = [c for c in summary if 0 < c["id"] < 1000]
    jobs = []
    for c in champs:
        alias = c["alias"].lower()
        jobs.append((f"{CDRAGON}/game/data/characters/{alias}/{alias}.bin.json",
                     raw / "champions" / "bins" / f"{alias}.bin.json"))
        for loc, (_g, plugin_loc, _d) in LOCALES.items():
            jobs.append((f"{CDRAGON_PLUGIN}/{plugin_loc}/v1/champions/{c['id']}.json",
                         raw / "champions" / loc / f"{c['id']}.json"))
    run(jobs, force)

    (raw / "VERSIONS.txt").write_text(f"game={game_version}\nddragon={dd_version}\n",
                                      encoding="utf-8")
    (RAW_ROOT / "CURRENT").write_text(game_version, encoding="utf-8")
    print(f"done: {len(champs)} champions")


def run(jobs, force: bool) -> None:
    failures = []

    def one(job):
        url, dest = job
        try:
            download(url, dest, force=force)
        except Exception as e:  # report and continue; build.py tolerates gaps
            failures.append((url, str(e)))

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(one, jobs))
    for url, err in failures:
        print(f"  FAILED {url}: {err}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
