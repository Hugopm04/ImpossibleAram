"""Turn raw community statistics (ARAMKit + u.gg) into compact app data.

Called by build.py. Produces, per champion (app/public/data/champstats/<Alias>.json):
  eligible   {augmentId: [stages]}         augments observed for the champion, per stage (D48)
  wr         {augmentId: [winRate, pickRate, samples]}   raw, not shrunk (D34)
  stageWr    {augmentId: {stage: [winRate, samples]}}
  pairs      [[augA, augB, winRate, samples]]            top observed augment pairs
  items      [[itemId, winRate, pickRate, samples]]      champion's overall item stats
  builds     {augmentId: {"items": [[itemId, wr, pick, n]], "order": [itemIds], "boots": itemId}}
  archetypes {key: share}                                 build archetype pick shares
  champion   {winRate, pickRate, samples, tier}
and globally (returned): odds (rarity per stage + transitions + sequences), augment global
stats, stage availability per augment, eligibility index {augmentId: [champion ids]}.
"""
from __future__ import annotations

from pathlib import Path

from common import load_json

TOP_ITEMS = 14


def _r(x, n=4):
    return round(x, n) if isinstance(x, float) else x


def load(raw: Path):
    ak = raw / "community" / "aramkit"
    if not (ak / "augment-rarity.json").exists():
        return None
    return ak


def odds(ak: Path) -> dict:
    r = load_json(ak / "augment-rarity.json")
    name = {"kSilver": "silver", "kGold": "gold", "kPrismatic": "prismatic", "silver": "silver",
            "gold": "gold", "prismatic": "prismatic", 0: "silver", 1: "gold", 2: "prismatic"}

    def rows_to_map(rows):
        out = {}
        for row in rows:
            key = row.get("rarity", row.get("id", row.get("key")))
            out[name.get(key, str(key))] = _r(row.get("probability", row.get("rate", 0.0)))
        return out

    stages = {s: rows_to_map(v.get("rows", [])) for s, v in r.get("stages", {}).items()}
    transitions = {}
    for k, v in r.get("transitions", {}).items():
        t = {}
        for row in v.get("rows", []):
            frm = name.get(row.get("from", row.get("rarity")), str(row.get("from")))
            t[frm] = {name.get(c.get("rarity", c.get("to")), str(c.get("to"))): _r(c.get("probability", 0.0))
                      for c in row.get("next", row.get("to", [])) if isinstance(c, dict)}
            if not t[frm]:
                t[frm] = {kk: _r(vv) for kk, vv in row.items() if kk in ("silver", "gold", "prismatic")}
        transitions[k] = t
    seqs = [{"rarities": [name.get(x, str(x)) for x in row.get("rarities", [])],
             "p": _r(row.get("probability", 0.0), 6)} for row in r.get("sequences", {}).get("rows", [])]
    return {"source": "ARAMKit augment-rarity (community estimate)", "stages": stages,
            "transitions": transitions, "sequences": seqs}


def champion_stats(ak: Path, key: int, pid_to_id: dict[int, str]) -> dict | None:
    p = ak / "champions" / f"{key}.json"
    if not p.exists():
        return None
    d = load_json(p)
    aug = d.get("augments", {})
    eligible, wr, stage_wr = {}, {}, {}
    for row in aug.get("all", []):
        aid = pid_to_id.get(row["id"])
        if not aid:
            continue
        eligible[aid] = row.get("availableStages") or [1, 2, 3, 4]
        wr[aid] = [_r(row.get("winRate", 0.0)), _r(row.get("pickRate", 0.0)), row.get("sampleCount", 0)]
    for stage, rows in aug.get("stages", {}).items():
        for row in rows:
            aid = pid_to_id.get(row["id"])
            if aid:
                stage_wr.setdefault(aid, {})[stage] = [_r(row.get("winRate", 0.0)), row.get("sampleCount", 0)]
                st = int(stage)
                if aid in eligible and st not in eligible[aid]:
                    eligible[aid] = sorted(set(eligible[aid]) | {st})
    pairs = []
    for row in d.get("augmentCombinations", []):
        ids = [pid_to_id.get(i) for i in row.get("augmentIds", [])]
        if all(ids):
            pairs.append(ids + [_r(row.get("winRate", 0.0)), row.get("sampleCount", 0)])
    items_src = d.get("items", {}).get("unfiltered", {}) or d.get("items", {}).get("filtered", {})
    items = [[str(i["id"]), _r(i.get("winRate", 0.0)), _r(i.get("pickRate", 0.0)), i.get("sampleCount", 0)]
             for i in items_src.get("all", [])[:60]]
    archetypes = {}
    tot = 0
    for a in d.get("builds", {}).get("filtered", {}).get("archetypes", []):
        archetypes[a["key"]] = a.get("sampleCount", 0)
        tot += a.get("sampleCount", 0)
    archetypes = {k: round(v / tot, 3) for k, v in archetypes.items()} if tot else {}
    ch = d.get("champion", {})
    st = ch.get("stats", {})
    out = {"eligible": eligible, "wr": wr, "stageWr": stage_wr, "pairs": pairs, "items": items,
           "archetypes": archetypes,
           "champion": {"winRate": st.get("winRate"), "pickRate": st.get("pickRate"),
                        "samples": st.get("sampleCount"), "tier": ch.get("tier"), "rank": ch.get("rank")}}
    sp = ak / "champions" / f"{key}-single-augments.json"
    builds = {}
    if sp.exists():
        s = load_json(sp)
        for row in s.get("items", []):
            aid = pid_to_id.get(row.get("augmentId"))
            if not aid:
                continue
            top = sorted(row.get("all", []), key=lambda i: -i.get("sampleCount", 0))[:TOP_ITEMS * 2]
            top = sorted(top, key=lambda i: -(i.get("winRate", 0) * min(1.0, i.get("sampleCount", 0) / 200)))
            builds[aid] = {"items": [[str(i["id"]), _r(i.get("winRate", 0.0)), _r(i.get("pickRate", 0.0)),
                                      i.get("sampleCount", 0)] for i in top[:TOP_ITEMS]]}
        for row in s.get("builds", []):
            aid = pid_to_id.get(row.get("augmentId"))
            if not aid or aid not in builds:
                continue
            best = None
            for arch in row.get("archetypes", []):
                for prof in arch.get("profiles", []):
                    for route in prof.get("routes", []):
                        score = route.get("winRate", 0) * min(1.0, route.get("sampleCount", 0) / 300)
                        if best is None or score > best[0]:
                            boots = (route.get("boots") or [{}])[0].get("item", {}).get("id")
                            best = (score, [str(x["id"]) for x in route.get("purchaseOrder", [])], boots,
                                    arch.get("key"), route.get("winRate"), route.get("sampleCount"))
            if best:
                builds[aid].update({"order": best[1], "boots": str(best[2]) if best[2] else None,
                                    "archetype": best[3], "orderWr": _r(best[4] or 0.0), "orderN": best[5]})
    out["builds"] = builds
    return out


def global_augments(ak: Path, pid_to_id: dict[int, str]) -> dict:
    r = load_json(ak / "augment-rankings.json")
    out = {}
    for row in r.get("all", []):
        aid = pid_to_id.get(row["id"])
        if aid:
            out[aid] = {"winRate": _r(row.get("winRate", 0.0)), "pickRate": _r(row.get("pickRate", 0.0)),
                        "samples": row.get("sampleCount", 0), "tier": row.get("tier"),
                        "stages": row.get("availableStages") or [1, 2, 3, 4]}
    return out


def ugg_eligibility(raw: Path, pid_to_id: dict[int, str]) -> dict[int, set[str]]:
    out = {}
    d = raw / "community" / "ugg" / "augments"
    if not d.exists():
        return out
    for f in d.glob("*.json"):
        data = load_json(f)
        out[int(f.stem)] = {pid_to_id[i] for lst in data.get("rarities", {}).values() for i in lst if i in pid_to_id}
    return out
