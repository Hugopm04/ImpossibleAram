"""Build the app's data files (app/public/data/*.json) from data/raw/<game version>/.

Usage:  python -I pipeline/build.py

Outputs (all bilingual en/es where text is involved):
  meta.json       versions, counts, tag-bit hypotheses
  augments.json   KIWI (ARAM: Mayhem) augments with rendered descriptions and numbers
  anvils.json     Stat Anvil shard options (Silver / Gold / Prismatic)
  champions.json  champions with stats, traits and rendered abilities (P/Q/W/E/R)
  items.json      ARAM (map 12) items from Data Dragon
  summoners.json  summoner spells available in Mayhem
  draft.json      augment draft config (cards per screen, fallback pools, display tags, quests)
And a QA report in data/reports/build-<version>.txt (unresolved placeholders etc.).
"""
from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with `python -I`: own folder only
import community
import profiles
from common import APP_DATA, CURATION, REPORTS, current_raw_dir, load_json, save_json
from render import SpellCtx, Strings, fmt_ranks, main_text, render

CD_GAME = "https://raw.communitydragon.org/latest/game/"
CD_PLUGIN_ASSETS = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/"
RARITY = {0: "silver", 1: "gold", 2: "prismatic"}
ANVIL_TIER = {0: "silver", 8: "gold", 9: "prismatic"}
LOCS = ("en", "es")
SPELL_REF = "<spellRef></spellRef>"  # the UI replaces it with the chosen ability's name

# Bit meanings are HYPOTHESES inferred from which augments carry each bit (see CLAUDE.md, M3).
BUILD_TAG_BITS = {1: "assassin", 2: "burn", 3: "enchanter", 4: "fighter", 5: "mage", 6: "marksman",
                  7: "artillery", 8: "tank", 9: "crit", 10: "autocast", 11: "spellcaster"}
AUGMENT_TAG_BITS = {1: "ap", 2: "ad", 3: "mana", 4: "resists", 5: "mobility", 6: "summonerSlot",
                    7: "longRange", 8: "ranged", 9: "closeRange", 10: "ultimate", 11: "healShield",
                    12: "support"}

report: list[str] = []


def asset_url(path: str | None) -> str | None:
    if not path:
        return None
    p = path.lower().replace(".tex", ".png").replace(".dds", ".png")
    return CD_GAME + p


def plugin_asset(path: str | None) -> str | None:
    """'/lol-game-data/assets/ASSETS/...' -> CDragon plugin URL."""
    if not path:
        return None
    p = path.replace("/lol-game-data/assets/", "").lower()
    return CD_PLUGIN_ASSETS + p


def bits(v: int | None, names: dict[int, str]) -> list[str]:
    v = v or 0
    return [names.get(b, f"bit{b}") for b in range(32) if v >> b & 1]


def clean_name(s: str | None) -> str | None:
    return re.sub(r"<[^>]+>", "", s).strip() if s else s


class Ctx:
    def __init__(self, raw: Path):
        self.raw = raw
        self.strings = {loc: Strings(load_json(raw / "strings" / f"{loc}.json")["entries"]) for loc in LOCS}
        self.kiwi = load_json(raw / "bins" / "kiwi.bin.json")
        self.map12 = load_json(raw / "bins" / "map12.bin.json")

    def text(self, key: str | None, spell_ctx, vars=None, tag="") -> dict[str, str]:
        out = {}
        for loc in LOCS:
            un: set = set()
            out[loc] = render(self.strings[loc].get(key), self.strings[loc], spell_ctx, loc, vars, un)
            if un and loc == "en":
                report.append(f"unresolved {tag} [{key}]: {sorted(un)}")
        return out

    def name(self, key: str | None) -> dict[str, str]:
        return {loc: clean_name(self.strings[loc].get(key)) or "" for loc in LOCS}


# ---------------------------------------------------------------- augments

def build_augments(c: Ctx, items_by_name: dict[str, dict[str, str]], champ_aliases: list[str]) -> list[dict]:
    kiwi = c.kiwi
    pool = next(v for v in kiwi.values() if isinstance(v, dict) and len(v.get("AugmentList", [])) > 100)
    curated_track = load_json(CURATION / "track.json") if (CURATION / "track.json").exists() else {}
    track_by_aug = {aid: m["milestone"] for m in curated_track.get("milestones", []) for aid in m.get("augments", [])}
    draft = c.map12.get("{a095d094}", {})
    fallback = {aid.split("/")[-1]: RARITY[p.get("rarity", 1)]
                for p in draft.get("{857c9848}", []) for aid in p.get("AugmentPool", [])}
    display = display_tag_names(c)
    alias_re = re.compile(r"(?:^|_)(" + "|".join(sorted(champ_aliases, key=len, reverse=True)) +
                          r")(Q|W|E|R|P|Passive)(?=$|[A-Z_]|Two|One)")
    out = []
    for path in pool["AugmentList"]:
        a = kiwi.get(path)
        if not isinstance(a, dict):
            report.append(f"missing augment object {path}")
            continue
        nid = a["AugmentNameId"]
        root = kiwi.get(a.get("RootSpell"), {}).get("mSpell", {})
        extra = [kiwi.get(s, {}).get("mSpell", {}) for s in a.get("AdditionalSpells", [])]
        sctx = SpellCtx(root, 1, 1, extra)
        vars = {"SpellName": SPELL_REF, "StatAnvilsToGrant": "2", "QuestTier": "3"}
        q = a.get("QuestData", {}).get("Quest")
        qobj = kiwi.get(q) if q else None
        if isinstance(qobj, dict) and qobj.get("Milestones"):
            vars["QuestRequirement"] = str(qobj["Milestones"][0].get("{7fec0982}"))
        summary = c.text(a.get("DescriptionTra"), sctx, vars, nid)
        tooltip = c.text(a.get("AugmentTooltipTra"), sctx, vars, nid)
        for loc in LOCS:  # a tooltip that is only a runtime include renders empty -> use summary
            if len(re.sub(r"<[^>]+>|\s", "", tooltip[loc])) < 8:
                tooltip[loc] = summary[loc]
        name = c.name(a.get("NameTra"))
        spell_paths = [a.get("RootSpell", "")] + list(a.get("AdditionalSpells", []))
        granted = sorted({f"{m.group(1)}:{m.group(2)[0]}" for sp in spell_paths
                          for m in alias_re.finditer(sp.split("/")[-1])})
        out.append({
            "id": nid,
            "platformId": a.get("AugmentPlatformId"),
            "rarity": RARITY[a.get("rarity", 0)],
            "enabled": a.get("Enabled", True) is not False,
            "name": name,
            "summary": summary,
            "tooltip": tooltip,
            "icon": asset_url(a.get("AugmentLargeIconPath")),
            "iconSmall": asset_url(a.get("AugmentSmallIconPath")),
            "buildTags": a.get("mBuildTags", 0),
            "buildTagNames": bits(a.get("mBuildTags"), BUILD_TAG_BITS),
            "augmentTags": a.get("mAugmentTags", 0),
            "augmentTagNames": bits(a.get("mAugmentTags"), AUGMENT_TAG_BITS),
            "displayTags": [display.get(t, {"en": str(t), "es": str(t)}) for t in a.get("AugmentDisplayTags", [])],
            "isAbility": bool(a.get("IsAbilityAugment")),
            "quest": build_quest(c, kiwi.get(q), sctx, vars) if q else None,
            "trackMilestone": track_by_aug.get(nid),
            "fallbackPool": fallback.get(nid),
            "linkedItems": link_items(tooltip, summary, items_by_name),
            "grantsAbilities": granted,
            "abilityRefs": ability_refs(tooltip["en"] + " " + summary["en"]),
            "summonerRefs": summoner_refs(tooltip["en"] + " " + summary["en"]),
            "values": {d["name"]: d.get("values", [0])[1] if len(d.get("values", [])) > 1 else d.get("values", [0])[0]
                       for sp in [root] + extra for d in sp.get("DataValues", []) if "name" in d},
        })
    return out


def display_tag_names(c: Ctx) -> dict[int, dict[str, str]]:
    cfg = c.map12.get("{359fb503}", {}).get("{96c6750b}", {})
    return {int(k): c.name(v.get("TagName")) for k, v in cfg.items()}


def build_quest(c: Ctx, q: dict | None, sctx: SpellCtx, vars: dict) -> dict | None:
    """Quest milestones rendered with the owning augment's numbers."""
    if not isinstance(q, dict):
        return None
    tag = q.get("QuestName", "quest")
    ms = []
    for m in q.get("Milestones", []):
        target = m.get("{7fec0982}")
        v = dict(vars, QuestRequirement=str(target), QuestTier=str(len(ms) + 1))
        ms.append({"target": target, "text": c.text(m.get("MilestoneDescriptionTra"), sctx, v, tag)})
    return {"id": q.get("QuestName"), "name": c.name(q.get("QuestNameTra")), "milestones": ms,
            "completeText": c.text(q.get("{c88f1a9b}"), sctx, vars, tag)}


ULT_RE = re.compile(r"\bultimate\b", re.I)
BASIC_RE = re.compile(r"\bbasic abilit", re.I)
SLOT_RE = re.compile(r"(?<![A-Za-z])([QWER])(?![A-Za-z])")


def ability_refs(text_en: str) -> list[str]:
    t = re.sub(r"<[^>]+>", " ", text_en)
    refs = set()
    if ULT_RE.search(t):
        refs.add("R")
    if BASIC_RE.search(t):
        refs |= {"Q", "W", "E"}
    for m in SLOT_RE.finditer(t):
        refs.add(m.group(1))
    if re.search(r"\babilities\b", t, re.I) and not refs:
        refs |= {"Q", "W", "E", "R"}
    return sorted(refs, key="PQWER".index)


SUMMONER_WORDS = {"Flash": "SummonerFlash", "Snowball": "SummonerSnowball", "Mark": "SummonerSnowball",
                  "Ghost": "SummonerHaste", "Ignite": "SummonerDot", "Barrier": "SummonerBarrier",
                  "Heal": "SummonerHeal", "Cleanse": "SummonerBoost", "Clarity": "SummonerMana",
                  "Summoner Spell": "*"}


def summoner_refs(text_en: str) -> list[str]:
    t = re.sub(r"<[^>]+>", " ", text_en)
    out = set()
    for w, sid in SUMMONER_WORDS.items():
        if w in ("Heal",):  # too generic as a word; only count explicit summoner wording
            if re.search(r"\bHeal\b(?= Summoner| summoner)", t):
                out.add(sid)
            continue
        if re.search(rf"\b{re.escape(w)}\b", t):
            out.add(sid)
    return sorted(out)


# Items an augment talks about without naming them (tag item:<X> in curation/augments.json).
ITEM_TAG_LINKS = {
    "item:Sheen": ["3057", "3078", "3100", "6662", "3508", "2510"],
    "item:InfinityEdge": ["3031"], "item:Collector": ["6676"], "item:Sunfire": ["3068", "6664"],
    "item:Zhonya": ["3157"], "item:SunderedSky": ["6610"], "item:RavenousHydra": ["3074"],
    "item:DeathsDance": ["6333"], "item:Heartsteel": ["3084"], "item:Wooglet": ["228002", "3089", "3157"],
    "item:VoidImmolation": ["223069", "3068", "6664"], "item:UltraHydra": ["226668", "3074", "3748", "6698"],
    "item:GoldenSpatula": ["994403"],
}


def link_items(tooltip: dict, summary: dict, items_by_name: dict[str, dict[str, str]]) -> list[str]:
    found = set()
    for loc in LOCS:
        t = re.sub(r"<[^>]+>", " ", tooltip[loc] + " " + summary[loc])
        for name, iid in items_by_name[loc].items():
            if name in t and re.search(r"(?<![\w'])" + re.escape(name) + r"(?![\w'])", t):
                found.add(iid)
    return sorted(found)


# ---------------------------------------------------------------- anvils

def build_anvils(c: Ctx) -> list[dict]:
    out = []
    for v in c.map12.values():
        if not (isinstance(v, dict) and v.get("__type") == "AnvilData"):
            continue
        root = c.map12.get(v.get("RootSpell"), {}).get("mSpell", {})
        sctx = SpellCtx(root, 1, 1)
        anvil_vars = {"StatAnvilsToGrant": "2"}
        tiers = sorted({ANVIL_TIER.get(t, str(t)) for t in v.get("AnvilTypes", [])})
        out.append({
            "id": v["AugmentNameId"],
            "tiers": tiers,
            "name": c.name(v.get("NameTra")),
            "tooltip": c.text(v.get("AugmentTooltipTra"), sctx, anvil_vars, v["AugmentNameId"]),
            "icon": asset_url(v.get("AugmentLargeIconPath")),
            "buildTags": v.get("mBuildTags", 0),
            "buildTagNames": bits(v.get("mBuildTags"), BUILD_TAG_BITS),
            "augmentTags": v.get("mAugmentTags", 0),
            "augmentTagNames": bits(v.get("mAugmentTags"), AUGMENT_TAG_BITS),
            "values": {d["name"]: (d.get("values") or [0, 0])[1] for d in root.get("DataValues", []) if "name" in d},
        })
    return sorted(out, key=lambda x: (x["tiers"], x["id"]))


# ---------------------------------------------------------------- champions

SLOTS = ["Q", "W", "E", "R"]


def build_champions(c: Ctx) -> list[dict]:
    raw = c.raw
    summary = [x for x in load_json(raw / "plugin" / "champion-summary.json") if 0 < x["id"] < 1000]
    gmeta = {v["name"]: v for v in load_json(raw / "bins" / "champions.bin.json").values()
             if isinstance(v, dict) and v.get("__type") == "Champion"}
    out = []
    for s in sorted(summary, key=lambda x: x["alias"]):
        alias = s["alias"]
        binp = raw / "champions" / "bins" / f"{alias.lower()}.bin.json"
        plug = {loc: load_json(raw / "champions" / loc / f"{s['id']}.json") for loc in LOCS
                if (raw / "champions" / loc / f"{s['id']}.json").exists()}
        if not binp.exists() or "en" not in plug:
            report.append(f"champion data missing for {alias}")
            continue
        b = load_json(binp)
        cr = next((v for v in b.values() if isinstance(v, dict) and v.get("__type") == "CharacterRecord"), None)
        if not cr:
            report.append(f"no CharacterRecord for {alias}")
            continue
        p_en = plug["en"]
        stats = {}
        for k, v in cr.items():
            if isinstance(v, dict) and "baseValue" in v:
                stats[k.replace("Modifiable", "")] = round(v["baseValue"], 4)
            elif k in ("baseMR", "mrPerLevel", "critDamageMultiplier", "acquisitionRange") and isinstance(v, (int, float)):
                stats[k] = round(v, 4)
        res = cr.get("primaryAbilityResource") or {}
        abilities = []
        passive_path = cr.get("mCharacterPassiveSpell")
        spell_paths = list(cr.get("spells") or [])
        ability_objs = {v.get("mRootSpell"): v for v in b.values() if isinstance(v, dict) and v.get("__type") == "AbilityObject"}
        for slot, sp_path in [("P", passive_path)] + list(zip(SLOTS, spell_paths)):
            abilities.append(build_ability(c, b, alias, slot, sp_path, plug, ability_objs.get(sp_path)))
        meta = gmeta.get(alias, {}).get("championMetadata", {})
        tool = cr.get("characterToolData") or {}
        out.append({
            "id": alias,
            "key": s["id"],
            "name": {loc: plug[loc]["name"] for loc in plug},
            "title": {loc: plug[loc].get("title", "") for loc in plug},
            "icon": CD_PLUGIN_ASSETS + f"v1/champion-icons/{s['id']}.png",
            "roles": p_en.get("roles", []),
            "attackType": p_en.get("tacticalInfo", {}).get("attackType"),
            "damageType": p_en.get("tacticalInfo", {}).get("damageType"),
            "playstyle": p_en.get("playstyleInfo", {}),
            "tags": [t for t in (meta.get("{90d227c0}"), meta.get("{434fc710}")) if t],
            "tagNames": {loc: [plug[loc].get("championTagInfo", {}).get("championTagPrimary"),
                               plug[loc].get("championTagInfo", {}).get("championTagSecondary")] for loc in plug},
            "searchTags": [t for t in (tool.get("searchTags"), tool.get("searchTagsSecondary")) if t],
            "shopFilter": gmeta.get(alias, {}).get("DefaultItemShopFilter"),
            "purchaseIdentities": cr.get("purchaseIdentities", []),
            "resource": res.get("arType", 0),
            "stats": stats,
            "abilities": abilities,
        })
    return out


def build_ability(c: Ctx, b: dict, alias: str, slot: str, path: str | None, plug: dict, aobj: dict | None) -> dict:
    so = b.get(path, {}) if path else {}
    sp = so.get("mSpell", {}) if isinstance(so, dict) else {}
    td = sp.get("mClientData", {}).get("mTooltipData", {})
    keys = td.get("mLocKeys", {})
    lvl = td.get("mLists", {}).get("LevelUp", {}).get("levelCount")
    ranks = 1 if slot == "P" else (lvl or (3 if slot == "R" else 5))
    child = []
    if aobj:
        child = [b.get(p, {}).get("mSpell", {}) for p in aobj.get("mChildSpells", []) if p != path]
    def lookup(script: str):
        for v in b.values():
            if isinstance(v, dict) and v.get("__type") == "SpellObject" and v.get("mScriptName", "").lower() == script.lower():
                return SpellCtx(v.get("mSpell", {}), ranks, 1)
        return None

    sctx = SpellCtx(sp, ranks, 1, child, lookup)
    obj = (so.get("mScriptName") or "") if isinstance(so, dict) else ""
    tooltip_key = keys.get("keyTooltip") or keys.get("keyTooltipExtended")
    tag = f"{alias}.{slot}"
    tooltip = c.text(tooltip_key, sctx, None, tag) if tooltip_key else {loc: "" for loc in LOCS}
    if not tooltip["en"]:
        gen = f"generatedtip_{'passive' if slot == 'P' else 'spell'}_{obj}_tooltip"
        for loc in LOCS:
            tpl = main_text(c.strings[loc].get(gen) or c.strings[loc].get(gen + "extended"))
            tooltip[loc] = render(tpl, c.strings[loc], sctx, loc)
    # names: prefer client plugin (exact localized names)
    name = {}
    short = {}
    icon = None
    for loc in LOCS:
        pl = plug.get(loc)
        if not pl:
            continue
        if slot == "P":
            pp = pl.get("passive", {})
            name[loc], short[loc] = pp.get("name", ""), pp.get("description", "")
            icon = plugin_asset(pp.get("abilityIconPath")) or icon
        else:
            ps = next((x for x in pl.get("spells", []) if x.get("spellKey", "").upper() == slot), {})
            name[loc], short[loc] = ps.get("name", ""), ps.get("description", "")
            icon = plugin_asset(ps.get("abilityIconPath")) or icon
    if not icon and sp.get("mImgIconName"):
        icon = asset_url(sp["mImgIconName"][0])
    scalings: dict[int, float] = {}
    for cname in (sp.get("mSpellCalculations") or {}):
        try:
            v, _pct, _prec = sctx.calc(cname)
        except Exception:
            continue
        for stat, _formula, coefs in v.scal:
            if coefs:
                scalings[stat] = max(scalings.get(stat, 0.0), round(abs(coefs[-1]), 4))
    cds = sp.get("cooldownTime") or (sp.get("Cooldown") or {}).get("values") or []
    mana = sp.get("mana") or []
    for loc in LOCS:
        if not tooltip.get(loc):
            tooltip[loc] = short.get(loc, "")
    return {
        "slot": slot,
        "script": obj,
        "name": name,
        "short": short,
        "tooltip": tooltip,
        "icon": icon,
        "ranks": ranks,
        "cooldown": fmt_ranks([cds[i] for i in range(1, ranks + 1) if i < len(cds)]) if cds and slot != "P" else "",
        "cost": fmt_ranks([mana[i] for i in range(0, ranks) if i < len(mana)]) if mana and any(mana) else "",
        "cooldownValues": [round(cds[i], 3) for i in range(1, ranks + 1) if i < len(cds)] if cds else [],
        "castRange": (sp.get("castRangeDisplayOverride") or sp.get("castRange") or [0, 0])[1] if sp else 0,
        "traits": sorted(t for t in (sp.get("mSpellTags") or []) if t),
        "scalings": {str(k): v for k, v in scalings.items()},
        "abilityTraits": (aobj or {}).get("AbilityTraits", 0),
    }


# ---------------------------------------------------------------- items & summoners

def build_items(c: Ctx) -> list[dict]:
    dd = {loc: load_json(c.raw / "ddragon" / f"item_{loc}.json") for loc in LOCS}
    out = []
    for iid, it in dd["en"]["data"].items():
        if not it.get("maps", {}).get("12"):
            continue
        if not it.get("gold", {}).get("purchasable") and not it.get("from"):
            pass
        es = dd["es"]["data"].get(iid, it)
        out.append({
            "id": iid,
            "name": {"en": it["name"], "es": es["name"]},
            "description": {"en": it.get("description", ""), "es": es.get("description", "")},
            "plaintext": {"en": it.get("plaintext", ""), "es": es.get("plaintext", "")},
            "gold": it.get("gold", {}),
            "tags": it.get("tags", []),
            "stats": it.get("stats", {}),
            "from": it.get("from", []),
            "into": it.get("into", []),
            "depth": it.get("depth", 1),
            "inStore": it.get("inStore", True) is not False and it.get("gold", {}).get("purchasable", False),
            "requiredChampion": it.get("requiredChampion"),
            "requiredAlly": it.get("requiredAlly"),
            "icon": f"https://ddragon.leagueoflegends.com/cdn/{dd['en']['version']}/img/item/{it['image']['full']}",
        })
    return sorted(out, key=lambda x: int(x["id"]))


def items_by_name(items: list[dict]) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {loc: {} for loc in LOCS}
    for it in items:
        if it["gold"].get("total", 0) < 300 and it["id"] not in ("6032",):
            continue  # skip consumables / trinkets / components too generic to link by name
        for loc in LOCS:
            n = re.sub(r"<[^>]+>", "", it["name"][loc]).strip()
            if len(n) >= 4:
                out[loc].setdefault(n, it["id"])
    return out


def build_summoners(c: Ctx) -> list[dict]:
    dd = {loc: load_json(c.raw / "ddragon" / f"summoner_{loc}.json") for loc in LOCS}
    out = []
    for sid, s in dd["en"]["data"].items():
        if "KIWI" not in s.get("modes", []):
            continue
        es = dd["es"]["data"].get(sid, s)
        out.append({
            "id": sid,
            "name": {"en": s["name"], "es": es["name"]},
            "description": {"en": s.get("description", ""), "es": es.get("description", "")},
            "cooldown": s.get("cooldownBurn"),
            "icon": f"https://ddragon.leagueoflegends.com/cdn/{dd['en']['version']}/img/spell/{s['image']['full']}",
        })
    return out


def build_draft(c: Ctx) -> dict:
    d = c.map12.get("{a095d094}", {})
    return {
        "cardsPerScreen": {RARITY[int(k)]: v for k, v in d.get("{8794a0e6}", {}).items()},
        "fallbackPools": {RARITY[p.get("rarity", 1)]: [x.split("/")[-1] for x in p.get("AugmentPool", [])]
                          for p in d.get("{857c9848}", [])},
        "displayTags": {str(k): v for k, v in display_tag_names(c).items()},
        "selectionLevels": [3, 7, 11, 15],
        "rerollsPerCard": 1,
    }


# ---------------------------------------------------------------- main

def item_stat_tags(it: dict) -> list[str]:
    st = it.get("stats", {})
    m = {"FlatMagicDamageMod": "gives:AP", "FlatPhysicalDamageMod": "gives:AD", "PercentAttackSpeedMod": "gives:AS",
         "FlatCritChanceMod": "gives:crit", "FlatHPPoolMod": "gives:HP", "FlatArmorMod": "gives:armor",
         "FlatSpellBlockMod": "gives:MR", "FlatMovementSpeedMod": "gives:MS", "PercentMovementSpeedMod": "gives:MS",
         "FlatMPPoolMod": "gives:mana", "PercentLifeStealMod": "gives:lifesteal"}
    tags = {v for k, v in m.items() if st.get(k)}
    if "AbilityHaste" in it.get("tags", []):
        tags.add("gives:AH")
    if "ArmorPenetration" in it.get("tags", []) or "MagicPenetration" in it.get("tags", []):
        tags.add("gives:pen")
    tags.add("item:any")
    return sorted(tags)


def merge_curation(augments: list[dict], items: list[dict], global_stats: dict) -> None:
    cur = load_json(CURATION / "augments.json")["augments"]
    tax = load_json(CURATION / "taxonomy.json")["assignments"]
    for a in augments:
        c = cur.get(a["id"])
        if c is None:
            report.append(f"no curated entry for augment {a['id']}")
            c = {"t": [], "g": 0, "c": 0, "f": 0, "time": "flat"}
        gs = global_stats.get(a["id"])
        seed = 1.0 + 3.0 * ((gs or {}).get("winRate", 0.5) - 0.5) if gs else 1.0
        a["type"] = tax.get(a["id"])
        a["cur"] = {"t": c.get("t", []), "g": c.get("g", 0), "c": c.get("c", 0), "f": c.get("f", 0),
                    "p": round(c.get("p", max(0.6, min(1.4, seed))), 3), "time": c.get("time", "flat"),
                    "boost": c.get("boost", {})}
        a["global"] = gs
        extra = [i for t in a["cur"]["t"] for i in ITEM_TAG_LINKS.get(t, [])]
        a["linkedItems"] = list(dict.fromkeys(a["linkedItems"] + extra))
    icur = load_json(CURATION / "items.json")
    cur_items = {**icur.get("items", {}), **icur.get("special", {})}
    for it in items:
        c = cur_items.get(it["id"], {})
        it["cur"] = {"t": sorted(set(c.get("t", [])) | set(item_stat_tags(it))), "g": c.get("g", 0),
                     "c": c.get("c", 0), "f": c.get("f", 0)}
        it["special"] = it["id"] in icur.get("special", {})


def main() -> None:
    raw = current_raw_dir()
    versions = dict(line.split("=", 1) for line in (raw / "VERSIONS.txt").read_text().split())
    print(f"building from {raw}")
    c = Ctx(raw)
    items = build_items(c)
    champions = build_champions(c)
    augments = build_augments(c, items_by_name(items), [ch["id"] for ch in champions])
    anvils = build_anvils(c)
    summoners = build_summoners(c)
    draft = build_draft(c)

    # community statistics (ARAMKit + u.gg)
    pid_to_id = {a["platformId"]: a["id"] for a in augments}
    ak = community.load(raw)
    global_stats, odds, eligibility = {}, None, {}
    ugg = community.ugg_eligibility(raw, pid_to_id)
    curated_champs = load_json(CURATION / "champions.json")
    items_by_id = {it["id"]: it for it in items}
    stats_dir = APP_DATA / "champstats"
    if ak:
        global_stats = community.global_augments(ak, pid_to_id)
        odds = community.odds(ak)
    for ch in champions:
        cs = community.champion_stats(ak, ch["key"], pid_to_id) if ak else None
        observed = set((cs or {}).get("eligible", {})) | ugg.get(ch["key"], set())
        if cs:
            for aid in ugg.get(ch["key"], set()) - set(cs["eligible"]):
                cs["eligible"][aid] = global_stats.get(aid, {}).get("stages", [1, 2, 3, 4])
            for aid in cs["eligible"]:
                eligibility.setdefault(aid, []).append(ch["id"])
            save_json(stats_dir / f"{ch['id']}.json", cs)
        prof = profiles.derive(ch, cs, items_by_id, curated_champs, observed)
        ch["profile"] = prof["attrs"]
        ch["flags"] = prof["flags"]
        ch["hasStats"] = cs is not None
        ch["abilityAugmentSlots"] = {a["id"]: profiles.ability_slots(ch, a["id"])
                                     for a in augments if a["isAbility"]}
    merge_curation(augments, items, global_stats)
    for a in augments:
        a["eligibleCount"] = len(eligibility.get(a["id"], []))
        a["stages"] = (global_stats.get(a["id"]) or {}).get("stages", [1, 2, 3, 4])
    for name in ("synergy", "vocabulary"):
        save_json(APP_DATA / f"{name}.json", load_json(CURATION / f"{name}.json"))
    track = load_json(CURATION / "track.json")
    meta = {
        "gameVersion": versions.get("game"),
        "ddragonVersion": versions.get("ddragon"),
        "patch": "26." + versions.get("game", "0.0").split(".")[1],
        "builtAt": dt.datetime.now().isoformat(timespec="seconds"),
        "counts": {"augments": len(augments), "enabledAugments": sum(a["enabled"] for a in augments),
                   "champions": len(champions), "items": len(items), "anvils": len(anvils),
                   "championsWithStats": sum(ch["hasStats"] for ch in champions)},
        "buildTagBits": BUILD_TAG_BITS,
        "augmentTagBits": AUGMENT_TAG_BITS,
        "communitySources": {"aramkit": (raw / "community" / "aramkit" / "DATAPATH.txt").read_text().strip()
                             if ak else None, "ugg": bool(ugg)},
    }
    for name, obj in [("meta", meta), ("augments", augments), ("anvils", anvils), ("champions", champions),
                      ("items", items), ("summoners", summoners), ("draft", draft), ("track", track),
                      ("eligibility", eligibility), ("odds", odds or {})]:
        save_json(APP_DATA / f"{name}.json", obj)
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"build-{versions.get('game')}.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(meta["counts"], f"{len(report)} report lines")


if __name__ == "__main__":
    main()
