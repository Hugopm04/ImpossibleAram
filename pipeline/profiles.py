"""Champion profiles: 0-1 attributes used for augment fit (see curation/vocabulary.json).

Auto-derived from the champion's kit (ability scalings, cooldowns, spell traits, cast ranges),
roles, and, when community data exists, from real builds (ARAMKit archetype shares and item
purchase shares). Curated flags/overrides from curation/champions.json are applied last.
"""
from __future__ import annotations

import re

CRIT_ITEMS_TAG = "CriticalStrike"


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def derive(ch: dict, cstats: dict | None, items_by_id: dict, curated: dict, observed: set[str]) -> dict:
    abil = {a["slot"]: a for a in ch["abilities"]}
    basics = [abil.get(s) for s in "QWE" if abil.get(s)]
    all_ab = [a for a in ch["abilities"] if a]
    roles = set(ch.get("roles", []))
    traits = [t for a in all_ab for t in a.get("traits", [])]
    tcount = lambda t: sum(1 for a in all_ab if t in a.get("traits", []))

    # --- scaling shares from the kit
    sc = {}
    for a in all_ab:
        for stat, coef in (a.get("scalings") or {}).items():
            sc[int(stat)] = sc.get(int(stat), 0.0) + coef
    ap_k = sc.get(0, 0.0)
    ad_k = sc.get(2, 0.0)
    hp_k = (sc.get(11, 0.0) + sc.get(12, 0.0)) * 8 + (sc.get(1, 0.0) + sc.get(6, 0.0)) * 1.0
    tot = ap_k + ad_k + hp_k or 1.0
    kit_ap, kit_ad, kit_tank = ap_k / tot, ad_k / tot, hp_k / tot

    # --- real build shares (ARAMKit archetypes + item purchases)
    arch = (cstats or {}).get("archetypes", {})
    b_ap = arch.get("ap", 0) + 0.5 * arch.get("hybrid", 0) + 0.5 * arch.get("utility", 0)
    b_ad = arch.get("crit", 0) + arch.get("lethality", 0) + arch.get("on_hit", 0) + arch.get("ad", 0) + \
        0.6 * arch.get("bruiser", 0) + 0.5 * arch.get("hybrid", 0)
    b_tank = arch.get("tank", 0) + 0.4 * arch.get("bruiser", 0)
    crit_share = arch.get("crit", 0)
    onhit_share = arch.get("on_hit", 0)
    if cstats and cstats.get("items"):
        w = sum(i[2] for i in cstats["items"]) or 1.0
        crit_items = sum(i[2] for i in cstats["items"] if CRIT_ITEMS_TAG in items_by_id.get(i[0], {}).get("tags", []))
        crit_share = max(crit_share, crit_items / w * 2.5)
    has_build = bool(arch)
    mix = (lambda k, b: 0.45 * k + 0.55 * b) if has_build else (lambda k, b: k)
    ap = clamp(mix(kit_ap, b_ap) * 1.15)
    ad = clamp(mix(kit_ad, b_ad) * 1.15)
    tank = clamp(mix(kit_tank, b_tank) * 1.3 + (0.25 if "tank" in roles else 0.0))

    cds = [a["cooldownValues"][-1] for a in basics if a.get("cooldownValues")]
    avg_cd = sum(cds) / len(cds) if cds else 10.0
    spam = clamp((15.0 - avg_cd) / 11.0 + 0.15 * (tcount("Trait_Ammo") > 0) + 0.1 * (tcount("Trait_NoCooldown") > 0))
    ranged = 1.0 if "Ranged" in ch.get("purchaseIdentities", []) else 0.0
    attack = clamp(0.25 + 0.55 * ("marksman" in roles) + 0.25 * ("fighter" in roles) + 0.6 * onhit_share
                   + 0.4 * crit_share + 0.2 * (tcount("PositiveEffect_EmpowerAttack") > 0)
                   + 0.15 * (tcount("Trait_AttackReset") > 0) - 0.25 * ("mage" in roles and "marksman" not in roles))
    crit = clamp(crit_share)
    dash = clamp((tcount("Trait_PlayerSelectedDashDirection") + tcount("PositiveEffect_Teleport")) / 2.0)
    cc = clamp((tcount("Trait_ImmobilizingCCSpell") + tcount("Trait_ImmobilizingCCAbility")) / 2.5)
    slows = sum(1 for a in all_ab if re.search(r"<status>\s*Slow", a.get("tooltip", {}).get("en", ""), re.I))
    slow = clamp(slows / 2.0 + 0.2 * cc)
    heal_shield = clamp((tcount("Trait_ActiveHeal") + tcount("Trait_Shield")) / 1.5)
    heals = sum(1 for a in all_ab if re.search(r"<heal(ing)?>", a.get("tooltip", {}).get("en", ""), re.I))
    self_heal = clamp(heals / 2.0 + 0.3 * tcount("Trait_SelfHeal"))
    role_list = ch.get("roles", [])
    ally = clamp((1.0 if role_list[:1] == ["support"] else 0.45 if "support" in roles else 0.0) + 0.25 * heal_shield)
    big_ult = alias_in(ch, curated, "bigUlt")
    r = abil.get("R")
    r_cd = (r or {}).get("cooldownValues", [100])[0] if r else 100
    ult = clamp(0.55 + 0.3 * big_ult + 0.1 * alias_in(ch, curated, "aoeUlt") + 0.1 * (r_cd <= 80))
    mana = 1.0 if ch.get("resource") == 0 else 0.0
    channel = 1.0 if tcount("Trait_ChannelSpell") or "DontChangeTheChannel" in observed else 0.0
    burn = clamp(tcount("Trait_DoT") / 1.5)
    summons = 1.0 if tcount("Trait_Pet") or alias_in(ch, curated, "summoner") else 0.0
    max_range = max([a.get("castRange", 0) or 0 for a in basics] + [0])
    long_range = clamp((max_range - 700) / 600.0)
    stealth = 1.0 if tcount("Trait_Invisibility") or tcount("Trait_Camouflage") or alias_in(ch, curated, "invisible") else 0.0
    aoe = clamp(tcount("Trait_AoE") / 3.0)
    prof = {
        "ap": ap, "ad": ad, "tank": tank, "attack": attack, "crit": crit, "spam": spam, "ult": ult,
        "noUlt": 1.0 - ult, "dash": dash, "cc": cc, "slow": slow, "healShield": heal_shield,
        "selfHeal": self_heal, "ally": ally, "mana": mana, "channel": channel, "burn": burn,
        "summons": summons, "longRange": long_range, "ranged": ranged,
        "closeRange": 1.0 - 0.8 * ranged, "stealth": stealth,
        "skirmish": clamp(0.45 + 0.25 * dash + 0.3 * aoe), "aoe": aoe,
        "burst": 0.8 if roles & {"assassin", "mage"} else 0.5,
        "damage": 0.5 if "support" in roles else 0.9,
        "mobility": clamp(0.6 + 0.3 * (1 - ranged) + 0.1 * dash),
        "spin": 1.0 if "ARAM_SpinToWin" in observed else 0.0,
    }
    for k, v in curated.get("overrides", {}).get(ch["id"], {}).items():
        prof[k] = v
        if k == "ult":
            prof["noUlt"] = 1.0 - v
    prof = {k: round(v, 3) for k, v in prof.items()}

    flags = {f for f, names in curated.get("flags", {}).items() if ch["id"] in names}
    if prof["tank"] >= 0.5:
        flags.add("tankScaler")
    if prof["ap"] >= 0.35 and prof["ad"] >= 0.35:
        flags.add("hybridScaler")
    if sc.get(-1, 0) > 0 or (mana and any(i[0] in ("3004", "3003", "6657", "3119") and i[2] > 0.15
                                           for i in (cstats or {}).get("items", []))):
        flags.add("manaStacker")
    if prof["selfHeal"] >= 0.5:
        flags.add("selfHealer")
    if prof["slow"] >= 0.5:
        flags.add("slower")
    if prof["burn"] >= 0.5:
        flags.add("burner")
    if prof["channel"] >= 1:
        flags.add("channeler")
    if prof["longRange"] >= 0.6 and ranged:
        flags.add("artillery")
    if prof["spin"] >= 1:
        flags.add("spinner")
    return {"attrs": prof, "flags": sorted(flags)}


def alias_in(ch: dict, curated: dict, flag: str) -> float:
    return 1.0 if ch["id"] in curated.get("flags", {}).get(flag, []) else 0.0


TRAIT_FOR = {
    "Ability_SelfAOE_DoubleCast": ["Trait_AoE"],
    "Missile_Split": ["Trait_Ranged_StopsFirstHit"],
    "SpellVolley": ["Trait_Ranged_StopsFirstHit", "Trait_Ranged_Piercing"],
    "ARAM_Multishot": ["Trait_Ranged_StopsFirstHit", "Trait_Ranged_Piercing"],
    "SnapBack": ["Trait_PlayerSelectedDashDirection", "PositiveEffect_Teleport"],
    "ARAM_Quickstep": ["*"],
    "ARAM_Terror": ["*"],
    "Bonk": ["PositiveEffect_EmpowerAttack", "Trait_AttackReset", "Trait_Strike"],
    "TitansPulse": ["Trait_DamageAbility"],
    "ItsGoTime": ["Trait_AttackBuff_Duration", "PositiveEffect_Boon", "Trait_Toggle"],
    "DoubleDefense": ["Trait_Shield"],
    "MercysStrike": ["Trait_ActiveHeal", "Trait_Shield"],
    "ARAM_SustainingStrike": ["Trait_DamageAbility"],
    "Terraind": ["Trait_CreateTerrain"],
    "Overkill": ["Trait_AttackBuff_Duration"],
    "DarkWind": ["Trait_ImmobilizingCCSpell", "Trait_ImmobilizingCCAbility"],
    "LittleExtraHelp": ["Trait_AttackBuff_Duration"],
    "ChainReaction": ["Trait_KnockBack"],
    "ARAM_RabbleRousing": ["*"],
    "KeepGoing": ["Trait_AttackBuff_Duration", "PositiveEffect_EmpowerAttack"],
    "WardingWeapon": ["Trait_DamageAbility"],
    "DoubleStrike": ["PositiveEffect_EmpowerAttack", "Trait_AttackReset"],
    "TrustyWeapon": ["Trait_DamageAbility"],
    "SpecializedEmpowerment": ["Trait_DamageAbility"],
    "ARAM_SpecializedRecursion": ["Trait_DamageAbility"],
    "Overloaded": ["*"],
}
SLOT_FIXED = {"ARAM_BreadAndButter": ["Q"], "ARAM_BreadAndJam": ["W"], "ARAM_BreadAndCheese": ["E"]}


def ability_slots(ch: dict, aug_id: str) -> list[str]:
    """Which of the champion's spells an ability augment can attach to (inferred, D48)."""
    if aug_id in SLOT_FIXED:
        return SLOT_FIXED[aug_id]
    need = TRAIT_FOR.get(aug_id)
    if need is None:
        return ["Q", "W", "E", "R"]
    out = []
    for a in ch["abilities"]:
        if a["slot"] == "P":
            continue
        tr = set(a.get("traits", []))
        if "*" in need or tr & set(need):
            if aug_id in ("SpecializedEmpowerment", "ARAM_SpecializedRecursion", "ARAM_Multishot") and a["slot"] == "R":
                continue
            out.append(a["slot"])
    return out
