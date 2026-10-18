"""Tooltip rendering: string tables, {{includes}}, @placeholders@ and spell calculations.

Turns Riot's tooltip templates plus the numbers in SpellObject data into display text
(HTML-ish markup kept as in game: <magicDamage>, <scaleAP>, ... the UI styles them).
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------- hashes

_M64 = (1 << 64) - 1
_P1, _P2, _P3, _P4, _P5 = (11400714785074694791, 14029467366897019727, 1609587929392839161,
                           9650029242287828579, 2870177450012600261)


def _rotl(x: int, r: int) -> int:
    return ((x << r) | (x >> (64 - r))) & _M64


def xxh64(data: bytes, seed: int = 0) -> int:
    """Pure-Python xxHash64 (string-table keys are hashed with it)."""
    n = len(data)
    i = 0
    if n >= 32:
        v1 = (seed + _P1 + _P2) & _M64
        v2 = (seed + _P2) & _M64
        v3 = seed & _M64
        v4 = (seed - _P1) & _M64
        while i <= n - 32:
            vs = []
            for v, off in ((v1, 0), (v2, 8), (v3, 16), (v4, 24)):
                lane = int.from_bytes(data[i + off:i + off + 8], "little")
                v = (v + lane * _P2) & _M64
                vs.append((_rotl(v, 31) * _P1) & _M64)
            v1, v2, v3, v4 = vs
            i += 32
        h = (_rotl(v1, 1) + _rotl(v2, 7) + _rotl(v3, 12) + _rotl(v4, 18)) & _M64
        for v in (v1, v2, v3, v4):
            v = (_rotl((v * _P2) & _M64, 31) * _P1) & _M64
            h = ((h ^ v) * _P1 + _P4) & _M64
    else:
        h = (seed + _P5) & _M64
    h = (h + n) & _M64
    while i <= n - 8:
        k = int.from_bytes(data[i:i + 8], "little")
        k = (_rotl((k * _P2) & _M64, 31) * _P1) & _M64
        h = ((_rotl(h ^ k, 27) * _P1) + _P4) & _M64
        i += 8
    if i <= n - 4:
        k = int.from_bytes(data[i:i + 4], "little")
        h = ((_rotl(h ^ ((k * _P1) & _M64), 23) * _P2) + _P3) & _M64
        i += 4
    while i < n:
        h = (_rotl(h ^ ((data[i] * _P5) & _M64), 11) * _P1) & _M64
        i += 1
    h ^= h >> 33
    h = (h * _P2) & _M64
    h ^= h >> 29
    h = (h * _P3) & _M64
    h ^= h >> 32
    return h


def fnv1a32(s: str) -> int:
    """Bin-file name hash (FNV-1a 32 over the lower-cased name)."""
    h = 0x811C9DC5
    for b in s.lower().encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def bin_hash(s: str) -> str:
    return "{%08x}" % fnv1a32(s)


class Strings:
    """One locale's string table with plain and hashed key lookup."""

    def __init__(self, entries: dict[str, str]):
        self.e = entries

    def get(self, key: str | None) -> str | None:
        if not key:
            return None
        k = key.lower()
        v = self.e.get(k)
        if v is None:
            v = self.e.get("{%010x}" % (xxh64(k.encode("utf-8")) & 0xFFFFFFFFFF))
        return v


# ---------------------------------------------------------------- stats

# mStat id -> (en label, es label, css scale class). Inferred from known abilities (see CLAUDE.md).
STATS = {
    0: ("AP", "PH", "scaleAP"),
    1: ("Armor", "armadura", "scaleArmor"),
    2: ("AD", "DA", "scaleAD"),
    4: ("Attack Speed", "velocidad de ataque", "scaleAS"),
    5: ("Magic Penetration", "penetración mágica", "scaleAP"),
    6: ("Magic Resist", "resistencia mágica", "scaleMR"),
    7: ("Move Speed", "velocidad de movimiento", "scaleMS"),
    8: ("Crit Chance", "prob. de crítico", "scaleCrit"),
    9: ("Crit Damage", "daño crítico", "scaleCrit"),
    10: ("Ability Haste", "celeridad de habilidades", "scaleHaste"),
    11: ("Health", "vida", "scaleHealth"),
    12: ("max Health", "vida máxima", "scaleHealth"),
    13: ("missing Health", "vida faltante", "scaleHealth"),
    14: ("current Health", "vida actual", "scaleHealth"),
    16: ("missing Health", "vida faltante", "scaleHealth"),
    18: ("Life Steal", "robo de vida", "scaleLifeSteal"),
    29: ("Lethality", "letalidad", "scaleAD"),
    31: ("Attack Range", "alcance de ataque", "scaleOther"),
}
FORMULA = {1: ("base ", "base "), 2: ("bonus ", " adicional")}
LEVEL_TXT = {"en": "based on level", "es": "según el nivel"}
STACK_TXT = {"en": "per stack", "es": "por acumulación"}


def stat_label(stat: int, formula: int, loc: str) -> tuple[str, str]:
    en, es, css = STATS.get(stat, (f"stat {stat}", f"estadística {stat}", "scaleOther"))
    if loc == "es":
        label = es
        if formula == 2:
            label = es + FORMULA[2][1]
        elif formula == 1:
            label = "base " + es
    else:
        label = en
        if formula in FORMULA:
            label = FORMULA[formula][0] + en
    return label, css


# ---------------------------------------------------------------- symbolic values

class Val:
    """Value of a calculation: per-rank flat numbers + stat scalings + level/stack terms."""

    __slots__ = ("flat", "scal", "level", "stacks", "unknown")

    def __init__(self, ranks: int):
        self.flat = [0.0] * ranks
        self.scal: list[tuple[int, int, list[float]]] = []  # (stat, formula, coef per rank)
        self.level: list[float] | None = None  # values at champion level 1..18
        self.stacks: list[float] | None = None  # per stack of some buff
        self.unknown = False

    @staticmethod
    def const(ranks: int, values) -> "Val":
        v = Val(ranks)
        v.flat = [float(x) for x in values]
        return v

    def is_flat(self) -> bool:
        return not self.scal and self.level is None and self.stacks is None and not self.unknown

    def add(self, o: "Val") -> "Val":
        r = Val(len(self.flat))
        r.flat = [a + b for a, b in zip(self.flat, o.flat)]
        r.scal = self.scal + o.scal
        r.level = _addl(self.level, o.level)
        r.stacks = _addl(self.stacks, o.stacks)
        r.unknown = self.unknown or o.unknown
        return r

    def scale(self, k: list[float]) -> "Val":
        r = Val(len(self.flat))
        r.flat = [a * b for a, b in zip(self.flat, k)]
        r.scal = [(s, f, [c * b for c, b in zip(cs, k)]) for s, f, cs in self.scal]
        kk = k[0] if k else 1.0
        r.level = [x * kk for x in self.level] if self.level else None
        r.stacks = [x * b for x, b in zip(self.stacks, k)] if self.stacks else None
        r.unknown = self.unknown
        return r

    def mul(self, o: "Val") -> "Val":
        if o.is_flat():
            return self.scale(o.flat)
        if self.is_flat():
            return o.scale(self.flat)
        # product of two variable terms: keep the variable side, scale by the other's flat
        if o.level is not None and not o.scal and self.scal == [] and self.level is None:
            r = o.scale(self.flat)
            return r
        r = self.scale(o.flat if any(o.flat) else [1.0] * len(self.flat))
        r.unknown = True
        return r


def _addl(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return [x + y for x, y in zip(a, b)]


# ---------------------------------------------------------------- calculation engine

class SpellCtx:
    """Numbers of one spell (plus optional fallback spells) for placeholder resolution."""

    def __init__(self, spell: dict, ranks: int, rank_offset: int = 1, extra: list[dict] | None = None,
                 lookup=None):
        self.ranks = ranks
        self.off = rank_offset
        self.lookup = lookup  # callable(script_name) -> SpellCtx | None, for @spell.X:Var@
        self.dv: dict[str, list[float]] = {}
        self.calcs: dict[str, dict] = {}
        self.effects: list[list[float]] = []
        for sp in [spell] + (extra or []):
            if not sp:
                continue
            for d in sp.get("DataValues") or []:
                name = d.get("name", "")
                vals = d.get("values") or [0.0] * 7
                self.dv.setdefault(name.lower(), vals)
            for name, c in (sp.get("mSpellCalculations") or {}).items():
                self.calcs.setdefault(name.lower(), c)
            if not self.effects:
                self.effects = [e.get("value") or [0.0] * 7 for e in sp.get("mEffectAmount") or []]
        # spell-level fields some tooltips reference by name
        sp = spell or {}
        cds = sp.get("cooldownTime") or (sp.get("Cooldown") or {}).get("values")
        if cds:
            self.dv.setdefault("cooldown", cds)
        if sp.get("mana"):
            self.dv.setdefault("cost", [0.0] + list(sp["mana"]))  # mana is 0-based per rank
        for field, name in (("mAmmoRechargeTime", "ammorechargetime"), ("mMaxAmmo", "maxammo")):
            if sp.get(field):
                self.dv.setdefault(name, sp[field])

    def rank_vals(self, arr) -> list[float]:
        out = []
        for r in range(self.ranks):
            i = r + self.off
            out.append(float(arr[i]) if i < len(arr) else float(arr[-1] if arr else 0.0))
        return out

    def find_dv(self, name: str):
        n = name.lower()
        if n in self.dv:
            return self.dv[n]
        return self.dv.get(bin_hash(name))

    def find_calc(self, name: str):
        n = name.lower()
        if n in self.calcs:
            return self.calcs[n]
        return self.calcs.get(bin_hash(name))

    # -- evaluation
    def part(self, p, depth=0) -> Val:
        R = self.ranks
        if depth > 12 or not isinstance(p, dict):
            v = Val(R)
            v.unknown = True
            return v
        t = p.get("__type", "")
        if t == "NamedDataValueCalculationPart":
            arr = self.find_dv(p.get("mDataValue", ""))
            if arr is None:
                v = Val(R); v.unknown = True; return v
            return Val.const(R, self.rank_vals(arr))
        if t == "NumberCalculationPart":
            return Val.const(R, [p.get("mNumber", 0.0)] * R)
        if t == "EffectValueCalculationPart":
            i = p.get("mEffectIndex", 1) - 1
            arr = self.effects[i] if 0 <= i < len(self.effects) else None
            if arr is None:
                v = Val(R); v.unknown = True; return v
            return Val.const(R, self.rank_vals(arr))
        if t in ("StatByCoefficientCalculationPart", "StatByNamedDataValueCalculationPart",
                 "StatBySubPartCalculationPart"):
            if t == "StatByCoefficientCalculationPart":
                coefs = [p.get("mCoefficient", 0.0)] * R
            elif t == "StatByNamedDataValueCalculationPart":
                arr = self.find_dv(p.get("mDataValue", ""))
                coefs = self.rank_vals(arr) if arr is not None else [0.0] * R
            else:
                sub = self.part(p.get("mSubpart"), depth + 1)
                coefs = sub.flat
            v = Val(R)
            v.scal = [(p.get("mStat", 0), p.get("mStatFormula", 0), coefs)]
            return v
        if t == "SumOfSubPartsCalculationPart" or t == "ClampSubPartsCalculationPart":
            v = Val(R)
            for sp in p.get("mSubparts") or []:
                v = v.add(self.part(sp, depth + 1))
            return v
        if t == "ProductOfSubPartsCalculationPart":
            return self.part(p.get("mPart1"), depth + 1).mul(self.part(p.get("mPart2"), depth + 1))
        if t == "ByCharLevelInterpolationCalculationPart":
            a, b = p.get("mStartValue", 0.0), p.get("mEndValue", 0.0)
            v = Val(R)
            v.level = [a + (b - a) * (L - 1) / 17 for L in range(1, 19)]
            return v
        if t == "ByCharLevelBreakpointsCalculationPart":
            val = p.get("mLevel1Value", 0.0)
            per = p.get("mInitialBonusPerLevel", 0.0)
            bps = {bp.get("mLevel"): bp for bp in p.get("mBreakpoints") or []}
            levels = [val]
            for L in range(2, 19):
                bp = bps.get(L)
                if bp:
                    val += bp.get("mAdditionalBonusAtThisLevel", 0.0)
                    if "mBonusPerLevelAtAndAfter" in bp:
                        per = bp["mBonusPerLevelAtAndAfter"]
                val += per
                levels.append(val)
            v = Val(R)
            v.level = levels
            return v
        if t == "ByCharLevelFormulaCalculationPart":
            vals = p.get("values") or []
            v = Val(R)
            v.level = [float(vals[min(i, len(vals) - 1)]) for i in range(1, 19)] if vals else None
            return v
        if t in ("BuffCounterByCoefficientCalculationPart", "BuffCounterByNamedDataValueCalculationPart"):
            if "mCoefficient" in p:
                per = [p["mCoefficient"]] * R
            else:
                arr = self.find_dv(p.get("mDataValue", ""))
                per = self.rank_vals(arr) if arr is not None else [0.0] * R
            v = Val(R)
            v.stacks = per
            return v
        if t == "AbilityResourceByCoefficientCalculationPart":
            v = Val(R)
            v.scal = [(-1, p.get("mStatFormula", 0), [p.get("mCoefficient", 0.0)] * R)]
            return v
        if "mSubparts" in p:  # unknown hashed sum-like part
            v = Val(R)
            for sp in p.get("mSubparts") or []:
                v = v.add(self.part(sp, depth + 1))
            return v
        v = Val(R)
        v.unknown = True
        return v

    def calc(self, c, depth=0) -> tuple[Val, bool, int | None]:
        """Evaluate a GameCalculation(-ish). Returns (value, display_as_percent, precision)."""
        R = self.ranks
        if isinstance(c, str):
            c = self.find_calc(c)
        if not isinstance(c, dict) or depth > 8:
            v = Val(R); v.unknown = True
            return v, False, None
        t = c.get("__type", "")
        if t == "GameCalculationModified":
            base, pct, prec = self.calc(c.get("mModifiedGameCalculation"), depth + 1)
            m = self.part(c.get("mMultiplier"), depth + 1)
            return base.mul(m), pct, prec
        if t == "GameCalculationConditional":
            target = c.get("mDefaultGameCalculation") or c.get("mConditionalGameCalculation")
            return self.calc(target, depth + 1)
        v = Val(R)
        for p in c.get("mFormulaParts") or []:
            v = v.add(self.part(p, depth + 1))
        if "mMultiplier" in c:
            v = v.mul(self.part(c["mMultiplier"], depth + 1))
        return v, bool(c.get("mDisplayAsPercent")), c.get("mPrecision")


# ---------------------------------------------------------------- formatting

def fmt_num(x: float, precision: int | None = None) -> str:
    if precision is not None:
        s = f"{x:.{max(0, precision)}f}"
    else:
        s = f"{x:.2f}" if abs(x) < 10 else f"{x:.1f}" if abs(x) < 100 else f"{x:.0f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def fmt_ranks(vals: list[float], mult: float = 1.0, precision=None, pct=False) -> str:
    xs = [fmt_num(v * mult, precision) for v in vals]
    suffix = "%" if pct else ""
    if len(set(xs)) == 1:
        return xs[0] + suffix
    return "/".join(xs) + suffix


def fmt_val(v: Val, loc: str, mult: float = 1.0, pct: bool = False, precision=None) -> str:
    if pct:
        mult *= 100
    parts = []
    has_flat = any(abs(x) > 1e-9 for x in v.flat)
    if v.level is not None:
        lv = [x + (v.flat[0] if has_flat else 0.0) for x in v.level]
        a, b = fmt_num(lv[0] * mult, precision), fmt_num(lv[-1] * mult, precision)
        s = a if a == b else f"{a} – {b}"
        parts.append(s + ("%" if pct else "") + (f" ({LEVEL_TXT[loc]})" if a != b else ""))
    elif has_flat or (not v.scal and v.stacks is None):
        parts.append(fmt_ranks(v.flat, mult, precision, pct))
    for stat, formula, coefs in v.scal:
        if stat == -1:
            label, css = ("max Mana" if loc == "en" else "maná máximo"), "scaleMana"
        else:
            label, css = stat_label(stat, formula, loc)
        coef_txt = fmt_ranks(coefs, 100 * (mult if not pct else mult / 100), None, True)
        parts.append(f"<{css}>(+{coef_txt} {label})</{css}>")
    if v.stacks is not None:
        parts.append(f"(+{fmt_ranks(v.stacks, mult, precision, pct)} {STACK_TXT[loc]})")
    s = " ".join(parts) if parts else "0"
    if v.unknown:
        s += "<unknown>?</unknown>"
    return s


# ---------------------------------------------------------------- templates

_PH = re.compile(r"@([A-Za-z_][A-Za-z0-9_\.:]*)(?:\*(-?[0-9]*\.?[0-9]+))?@")
_INC = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")
_ICON = re.compile(r"%i:([A-Za-z0-9_]+)%")
_EFFECT = re.compile(r"^(?:Effect(\d+)Amount|e(\d+))$", re.I)

SPECIAL_EMPTY = {"spellmodifierdescriptionappend", "spellmodifierpickdescriptionappend",
                 "hotkey", "keyhotkey", "levelUphotkey".lower(), "extendedkeybind", "spelltags"}


def render(template: str | None, strings: Strings, ctx: SpellCtx | None, loc: str,
           vars: dict[str, str] | None = None, unresolved: set | None = None, depth: int = 0) -> str:
    """Resolve {{includes}}, @placeholders@ and %i:icons% in a template."""
    if not template:
        return ""
    vars = {k.lower(): v for k, v in (vars or {}).items()}

    def inc(m):
        key = m.group(1)
        if key.lower() in vars:
            return vars[key.lower()]
        key = _PH.sub(lambda mm: vars.get(mm.group(1).lower(),
                                          "0" if re.fullmatch(r"f\d+", mm.group(1).lower()) else mm.group(0)), key)
        sub = strings.get(key)
        if sub is None or depth > 6:
            return ""
        return render(sub, strings, ctx, loc, vars, unresolved, depth + 1)

    text = _INC.sub(inc, template)

    def ph(m):
        name, mult_s = m.group(1), m.group(2)
        mult = float(mult_s) if mult_s else 1.0
        low = name.lower()
        if low in vars:
            return vars[low]
        if low in SPECIAL_EMPTY:
            return ""
        if re.fullmatch(r"f\d+(\.\d+)?", low) or low in ("questprogress",):  # live in-game counters
            return "0"
        target = ctx
        if low.startswith("spell.") and ":" in name and ctx is not None and ctx.lookup:
            spell_name, name = name[6:].split(":", 1)
            target = ctx.lookup(spell_name)
        ctx_ = target
        if ctx_ is not None:
            base = name.split(".")[0]
            c = ctx_.find_calc(base)
            if c is not None:
                v, pct, prec = ctx_.calc(c)
                return fmt_val(v, loc, mult, pct, prec)
            arr = ctx_.find_dv(base)
            if arr is not None:
                return fmt_ranks(ctx_.rank_vals(arr), mult)
            em = _EFFECT.match(base)
            if em:
                i = int(em.group(1) or em.group(2)) - 1
                if 0 <= i < len(ctx_.effects):
                    return fmt_ranks(ctx_.rank_vals(ctx_.effects[i]), mult)
        if unresolved is not None:
            unresolved.add(name)
        return "?"

    text = _PH.sub(ph, text)
    text = _ICON.sub(lambda m: f'<i data-icon="{m.group(1)}"></i>', text)
    return text.strip()


def main_text(generated: str | None) -> str | None:
    """Extract <mainText> from a generated full tooltip template."""
    if not generated:
        return None
    m = re.search(r"<mainText>(.*?)</mainText>", generated, re.S)
    return m.group(1) if m else generated
