"""Shared paths and download helpers for the data pipeline (stdlib only)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_ROOT = ROOT / "data" / "raw"
REPORTS = ROOT / "data" / "reports"
CURATION = ROOT / "curation"
APP_DATA = ROOT / "app" / "public" / "data"

CDRAGON = "https://raw.communitydragon.org/latest"
CDRAGON_PLUGIN = CDRAGON + "/plugins/rcp-be-lol-game-data/global"
DDRAGON = "https://ddragon.leagueoflegends.com"

# Locale codes: our id -> (CDragon game folder, CDragon plugin folder, DDragon folder)
LOCALES = {
    "en": ("en_us", "default", "en_US"),
    "es": ("es_es", "es_es", "es_ES"),
}

UA = {"User-Agent": "ImpossibleAram-pipeline/1.0 (personal fan tool)"}


def http_get(url: str, retries: int = 4) -> bytes:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:  # network hiccup
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET failed after {retries} tries: {url}: {last}")


def http_json(url: str):
    return json.loads(http_get(url).decode("utf-8"))


def download(url: str, dest: Path, force: bool = False) -> Path:
    """Download url to dest unless it already exists (raw cache)."""
    if dest.exists() and not force and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = http_get(url)
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    return dest


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, obj, compact: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write("\n")


def current_raw_dir() -> Path:
    """The raw folder of the most recently fetched game version."""
    marker = RAW_ROOT / "CURRENT"
    if not marker.exists():
        raise SystemExit("No raw data yet: run `python pipeline/fetch.py` first.")
    return RAW_ROOT / marker.read_text(encoding="utf-8").strip()
