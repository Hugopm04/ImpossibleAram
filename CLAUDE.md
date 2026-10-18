# ImpossibleAram — project index

This file is the **single source of truth for continuing work across chats**. Any new session
reads this first and continues from the "Current status" section.

## Working rules (from the user — mandatory)

1. **Ask relentlessly before building.** Keep asking the user questions until the requirements
   are clear-very-clear. Only then say explicitly that you are ready, and start working.
   If a new phase or feature brings new ambiguity, go back to asking before building it.
2. **Keep this file as the index.** Everything a future chat needs to continue from where the
   last one stopped is documented / indexed here: decisions, data sources, file layout,
   status, open questions. Update it as part of every change, including this rule itself.

## Goal (summary)

Find the craziest possible **champion + augment combinations in League of Legends ARAM: Mayhem**:
fast exponential growth, almost zero counterplay, really funny or extravagant.

A UI where the user can:
- view **general stats**, or
- **select a champion** → see the augments available to that champion ranked by "craziness"
  given the augments already picked; **pick one** → it's applied and the ranking updates.
- **hover any augment** → its description (with numbers); if it interacts with items or
  champion abilities, those are viewable with their descriptions in place (no tab switching).

Data needed per augment: identity, rarity, champions it can appear for, offer probability
(normal selection and after reroll), what it does with numbers, and **our own classification
of augment types**.

### Original brief (verbatim)

> There are multiple different kinds, types and ratiries of augments in Aram Mayhem in Leage of
> Legends. Furthermore, there is a huge champion pool and some augments only appear to certain
> champions. The aim of this project is to search the craziest possible combinations of augments
> and champions. We are looking for fast exponential growth, almost zero counterplay, really
> funny or extravagant... For this I will need a UI, where I can either check general stats or
> select a champ, with the champ selected I have an overview of the best augments for this
> purpose listed by how crazy they would be given which augments I have already. I want that
> putting the cursor over any augment shows its description, if it has items or abilities which
> it interacts with I want to be able to see them and their description without going to a
> different tab. I can then choose and augment of the list to apply to that champion, and the
> list get updated with that. We will need data about the augments, which augments are, their
> rarity, the champions in which they can appear, the probability of one appearing (either
> through normal selection or after re-roll), what does each one do, including the numbers, our
> own clasiffication of augment types... Ask me relentlessly until you have this
> clear-very-clear and then tell me you are ready and get to work. Document / index everything
> needed for any future chat in CLAUDE md to be able to continue from where it was left,
> including this rule.

## Current status

**Phase 3 — formula v2 (mechanical simulation), started 2026-10-18.** v1 (M1–M9) works end to
end. The user found the v1 leaderboard dominated by generic, easily-countered HP-stacking tanks
(axes on different scales, item×augment rule repeats, no counter model). After a Q&A round the
formula is being rebuilt as a minute-by-minute game simulation (D55–D72). Work order (D73):
UI batch first (M10, pushed), then the simulation (M11–M16, pushed when complete).

### How to continue in a new session

1. Read this file, then `README.md` (run commands).
2. If the user played and rated builds: read `feedback/*.json` (format in `feedback/README.md`),
   compare `computed` vs ratings/comments, adjust `curation/*.json`, rebuild
   (`python -I pipeline/build.py`, `cd app && npm run precompute`), log the change below
   ("Refinement log").
3. New patch: `python -I pipeline/update.py`, then curate whatever
   `data/reports/diff-*.md` lists under "Needs curation"; refresh the spot-check pack if useful.
4. Requirements are in "Decisions"; anything not covered there → ask the user first (rule 1).

### Build plan (milestones)

- [x] M1 Scaffolding: git repo, folder layout, `.gitignore`, README.
- [x] M2 Data pipeline (`pipeline/`): raw game data per patch → bilingual app JSON.
- [x] M3 Research: rarity odds (ARAMKit), sets (removed in 26.12), eligibility matrix (ARAMKit +
      u.gg), stage availability. Still open (handled as estimates): 5th slot (D16), Golden Reroll
      chance, exact ability-augment → spell mapping (inferred from traits).
- [x] M4 Taxonomy (`curation/taxonomy.json`, 22 primary types): approved (D47); restriction
      approach approved (D48).
- [x] M5 Curation: augment tags + G/C/F/power/timing, vocabulary, synergy rules + combos +
      conflicts + exclusions, champion flags/overrides, item mechanics; champion profiles
      auto-derived (`pipeline/profiles.py`).
- [x] M6 Scoring engine (`app/src/engine/`, TypeScript, shared by app and Node scripts).
- [x] M7 UI (React + Vite): planner, live, encyclopedia, leaderboards, ceilings, settings,
      nested hover cards, feedback form + auto-tune + feedback files.
- [x] M8 Leaderboard precompute (`app/scripts/precompute.ts`) and patch update script
      (`pipeline/update.py`) with diff report.
- [x] M9 Spot-check pack `curation/SPOTCHECK.md` (D39); docs pass.
- [x] M10 UI batch: `run.sh` (D50), sortable champion picker (D51), sortable combos + per-axis
      search (D53), sort-button headers (D54), live re-weight of precomputed scores (D52).
- [ ] M11 Simulation data: champion averages (gold/min, K/D/A per min, damage mix, duration),
      reference enemy (D62), normal Mayhem player baseline (D58), screen timing (D59/D70),
      ARAM balance modifiers research (D71).
- [ ] M12 Mechanics encoding: every enabled augment, legendary item/boots/quest item, champion
      abilities (data ratios) + hand-encoded stacking kits (D55, D57).
- [ ] M13 Simulation engine + outputs + axes v2 (D56–D61, D63–D66) replacing tag-point G/C.
- [ ] M14 Item optimizer (D64), planner speed modes (D69), precompute v2 (D53).
- [ ] M15 UI v2: curve chart (D68), knobs + "I'm seeing…" enemy chips (D62, D69), Live timer
      (D70), stale/recompute (D52).
- [ ] M16 Calibration report + spot-check curves (D67); docs pass; push.

### Refinement log

- 2026-10-18: v1 curated layer written by Claude (no user feedback yet).
- 2026-10-18: user review of the v1 leaderboard: top 20 = the same HP-stacking package on tanks
  (G ≈ 85 vs C ≈ 18; 41 item×augment rule hits = 47 of Sion's 86 G; no counter model). Led to
  formula v2 (D50–D73).

## Decisions (answers from the user)

| # | Topic | Decision |
|---|---|---|
| D1 | Augment pool | **Only `KIWI`** (classic ARAM: Mayhem). Ignore `KIWI_JADE`. |
| D2 | Platform | **Local web app**: Python script builds JSON data from game files; React + Vite app served on localhost. |
| D3 | Language | **English and Spanish, switchable** in the UI (UI strings + game texts from both locales' string tables). |
| D4 | Scoring | A **formula designed together with the user through Q&A**. It must represent the *potential* of an augment **given the champion and its current and future augments**. Refinement loops: (a) after all augments of a build are chosen, the user can give feedback; (b) before starting a game the formula can be refined further *if the user asks*. Ask the user as much as needed about the formula. |
| D5 | Combining axes | Three axes — **G** fast exponential growth, **C** almost zero counterplay, **F** funny/extravagant — combine as a **weighted sum**; default weights agreed with the user, **adjustable live with sliders** in the UI. |
| D6 | Weak gimmicks | **Power is a multiplier**: craziness = (weighted G/C/F sum) × realistic "does it actually work" factor, so weak gimmicks sink. |
| D7 | Future augments | Show **both expected value** (future synergy weighted by real offer odds) **and best case** (ceiling with ideal follow-ups); the list can be sorted by either. |
| D8 | Feedback loop | **Both**: (a) a rating in the UI auto-tunes formula weights live (small adjustments); (b) rating + comments + full build are saved to a feedback file in the project, which Claude reads in a later chat to refine formula/tags (documenting changes here). |
| D9 | G axis contents | Growth counts **all of**: uncapped stacking, multiplicative stat loops, early snowball speed, physical growth (size / max HP / range). |
| D10 | C axis contents | No-counterplay counts **all of**: unkillable (invuln/untargetable, revives, sustain, shields, DR), unavoidable damage (global/huge range, point-and-click, AoE, true damage), unstoppable (CC immunity, tenacity, mobility), enemy lockdown (perma-CC). |
| D11 | F axis contents | Fun counts **all of**: visual absurdity, ability spam, weird mechanics (other champs' abilities, pets, poros, transformations), off-role absurdity. |
| D12 | Power multiplier source | Rare combos expected, so the power factor blends **three sources**: curated estimate, community win rates (where data exists), and **the user's own feedback scores**. |
| D13 | Anvils | **Stat Anvils are a special augment type** that must be in the formula. They **appear in the ranked list** but are **not recorded in feedback**. In-game: opening an anvil offers a **choice of 1 of 3 stats** (per the user). List form: **one entry per tier (Silver/Gold/Prismatic) + a stat breakdown** on hover/expand showing how good each stat outcome is for the build. |
| D14 | Realism | **Strictly realistic** builds only: what can actually happen in a game (4 picks at levels 3/7/11/15 + special slot, round rarity, no duplicates, exclusions). No sandbox mode. |
| D15 | Mayhem Progression Track | The user calls it "the battle pass". The user is **partially** through it, so which track-locked augments they can be offered must be modelled (exact milestone pending). |
| D16 | 5th slot | Unknown to the user: they think ability augments and quest rewards have their own slots, and maybe the 5th slot is for an augment that grants extra augments (Transmute-like). **Research from game files.** |
| D17 | Champion restrictions | The user knows of class/role-based, kit-based and champion-specific restrictions. Examples: "become melee + gain stats" never offered to melee champs; on-hit augments offered to marksmen differ from mages. **Reverse-engineer from game data** (`mBuildTags` / `mAugmentTags` etc.). **If a perfect result isn't reached, ask the user: they have a good idea for it.** |
| D18 | Odds source | **Game data first**, then community estimates where missing; every estimated number is **flagged as an estimate** in the UI. |
| D19 | Track input | A **milestone number setting (0–32)**; the tool derives unlocked track augments and whether Golden Reroll / Ability Augment+ are active. User's exact milestone still unknown (ask, or let them set it). |
| D20 | Usage modes | **Both planning and live** (live = enter the offered cards / reroll results, get pick + reroll advice). It is **also a statistical toy**: exploring which combinations exist and their potential power is a goal in itself. |
| D21 | General stats view | **Craziest combos leaderboard** (across all champions), **augment encyclopedia** (filters: rarity, our types, sets, tags, restrictions, odds), **champion ceilings** (champions ranked by craziness ceiling / expected craziness). Community stats are *not* a separate view (they still feed the power factor, D12). |
| D22 | Nested info | **Nested hover cards**: item/ability names inside a tooltip are highlighted; hovering opens their own card beside it (chainable); click pins. |
| D23 | Probabilities everywhere | Display **the probability of each thing happening**, both **predicted** (future offers, follow-ups, builds) and **already shown/happened** (how likely the offered cards / the obtained build were), so builds can also be judged crazy **by rareness**. |
| D24 | Rareness in score | **Display only**: probability is shown and sortable, but does **not** change the craziness score. |
| D25 | Items | An augment's craziness depends on the champion **and the items it builds**, so **whenever an augment is shown for a situation, also show its best build scenario** (items). |
| D26 | Feedback form | Overall 1–10, per-axis 1–10 (G / C / F / "did it work") and a free-text comment, **all optional, but at least one field must be filled**. |
| D27 | Taxonomy | **Claude proposes** an augment-type taxonomy drafted from all augments; **the user reviews/edits** it before tagging starts. |
| D28 | Item basis | Show **both**: score with the **unconstrained best build** *and* score with the **best build given locked items** (items the user already owns in live mode, remaining slots re-optimized). |
| D29 | Build depth | **Full 6 items incl. boots, with buy order**, plus anvil stat choices. |
| D30 | Summoner spells | Shown/scored **only when an owned/considered augment interacts with them**. Exhaust is banned in Mayhem. |
| D31 | Team comps | **Champion-centric**: ally/enemy compositions are not modelled. |
| D32 | Default weights | **G 40 / C 35 / F 25** (slider defaults). |
| D33 | Time horizon | **Whole-game curve**: simulate power over a typical game; early snowball speed and late ceiling both count. |
| D34 | Power blend | **Curated base + raw win rate + feedback.** Win rates are used **raw, NOT shrunk by sample size**: crazy combos are super rare, so sample-size weighting would hide them. |
| D35 | Maintenance | **Local git repo (no remote) + one-command update script** per patch: re-pulls game data, keeps curated tags, writes a diff report flagging changed augments for re-review. |
| D36 | Power formula | **power = curated (0.3–1.5) + a·(raw WR − 50%) + b·(user rating − 5.5)/4.5**, each term only when its data exists; WR sample size displayed but never used to shrink. Defaults **a = 1, b = 0.5**, both editable in settings and auto-tuned by feedback. |
| D37 | User's milestone | Unknown: **default 0** in settings; the user sets it in the UI after checking in-game. |
| D38 | Delivery | **Build everything, then show** (no incremental demos). |
| D39 | Review depth | User approves **taxonomy + formula**; Claude tags all augments/champions, then shows **samples and the most controversial / high-impact tags** for spot checks. Feedback refines the rest. |
| D40 | Checkpoints | Despite D38, **pause and ask** only for: (a) taxonomy review (D27), (b) champion restrictions if decoding isn't perfect (D17). |
| D41 | Commits | **Commit automatically at working milestones.** (Push policy: see D49.) |
| D42 | Style | **LoL Hextech dark**: dark blue/black, gold accents, in-game rarity colours (silver / gold / prismatic). |
| D43 | Spanish variant | **es_ES** (Spain) string tables. |
| D44 | Synergy model | **General tag rules** (e.g. stacker × stat amp multiply, on-hit × attack speed, haste × per-cast) **+ hand-written curated combos** with explicit bonuses **+ set bonuses** from game data. |
| D45 | Anti-synergy | **Warning only**: conflicts are flagged with an explanation; the score is **not** lowered and nothing is hidden. (Superseded for simulated clashes by D66.) |
| D47 | Taxonomy approved | The 22 primary types in `curation/taxonomy.json` are **approved as is** (2026-10-18). Next layer: multi-valued mechanic tags + curated G/C/F/power per augment. |
| D48 | Eligibility source | **Observed data** (augments seen per champion and per stage in real games: ARAMKit, cross-checked with u.gg) is the eligibility source; ability-augment spells inferred from `Trait_*` spell tags. The user agreed this is what they would have suggested. |
| D49 | Remote | `origin` = https://github.com/Hugopm04/ImpossibleAram (empty repo prepared by the user). **Commit and push once the build is done** (user request 2026-10-18, supersedes "never pushed" in D41). |
| D46 | Luck model | **Keep both columns** (refines D7): **Best case** = optimal play + best luck ever (every future offer goes your way); **Expected** = optimal play with real odds. Default sort: best case. The probability of the best case is shown next to it. |
| D50 | Run command | `./run.sh` (Git Bash): `npm install` only when needed, start the dev server, open the browser. |
| D51 | Champion picker | Planner and Live: **icon grid + score badge + sort bar**; sort by ceiling (default, best case as D46), expected, name, G, C, F. |
| D52 | Stale scores | Precomputed champion/leaderboard scores **re-weight instantly** when G/C/F sliders move (stored axes × power). Knob / enemy changes mark them **stale** with a **Recompute** button running the full search in the background. |
| D53 | Combos list | Sortable columns; precompute **also searches the most-G, most-C and most-F build** per champion, and the list covers **all champions** (not a top 150). |
| D54 | Sort headers | Sortable headers look like buttons: ⇅ on every sortable one, active ▼/▲ in gold, frame + hover; non-sortable headers stay plain. **Second click flips** the direction. |
| D55 | Formula v2 | **Mechanical simulation replaces tag points for G and C.** A typical game is simulated minute by minute per champion + build: level, gold (champion's real gold/min), items completed in buy order when affordable, augments at their screens, events at the champion's real rates (ARAMKit kills/deaths/assists per minute, time in combat). **Every** augment, item and champion passive/ability is encoded as mechanics with real numbers (flat stats, per-event stacks with caps / lose-on-death, conversions, amplifiers, procs, internal cooldowns). Compounding emerges from the simulation (Heartsteel + HP augment = exponential HP; + HP per takedown = linear × exponential; + execute scaling with HP = exponential execute). The user's Heartsteel example applies to everything. Goal: "a real crazy-build maker, not the biggest theoretical number". |
| D56 | Value | **Champion-effective gold**: stats count only through what they do for this champion (damage via its real ratios vs the reference enemy; toughness = effective HP vs the reference enemy's damage mix, so %max-HP damage, anti-heal and penetration discount HP/heals/armor), converted to gold-equivalent. |
| D57 | Outputs | Per minute: **Damage** (burst + sustained DPS), **Toughness** (EHP, shields, sustain, revives, invuln/stasis uptime), **Reach & speed** (range, move speed), **Control** (CC seconds). Non-stat effects are simulated where meaningful (invuln/revive → toughness, CC immunity/tenacity → less enemy control on you, summons/sharks/poros → damage + control); purely visual parts stay curated F. |
| D58 | Baseline | Advantage = output ÷ a **normal Mayhem player**: same champion, its most common items and the most-picked augments per screen (ARAMKit). |
| D59 | Game length | Bell-shaped distribution around the champion's real average duration (spread = estimate), **every minute** evaluated and weighted by P(game still going). Augment screen minutes derived from data (XP curve + game data), flagged as estimates. |
| D60 | Axes v2 | **G** = expected fight-power advantage × (1 + k · growth slope), fight power = √(Damage adv × Toughness adv). **C** = **soft max** of Toughness, Reach & speed and Control advantages + qualitative (invuln, CC immunity, untargetable). **F** = curated fun + absurd-number bonus (size & MS, range & AS, ability spam, giant totals) vs the normal Mayhem player. Each axis **normalized by its own 95th percentile** across champion ceilings, then the weighted sum (D5/D32 unchanged). |
| D61 | Spam fun | Payload frequency counts when it beats **both** the League norm for that payload (invuln ≈ 2 min, ult ≈ 80–120 s, hard CC ≈ 10–15 s, big heal/shield ≈ 20 s) **and** the champion's own normal; **only build-driven** (augment/item adds the payload or boosts its frequency; a naked Jayce R gets nothing; Jayce + invuln-on-ult every 15 s is great). Payload weights **invuln > hard CC > heal/shield > damage**, ult casts extra. Grows **per doubling** (log). |
| D62 | Reference enemy | **Average ARAM enemy from data** (pick-rate weighted across champions): damage split, %max-HP share, anti-heal prevalence, armor/MR/HP by minute, **typical augments**. Adjusted by **"I'm seeing…" chips** in player language (none / some / lots; some = data average), **specific enemy champion + augment combos** (extra weight), and **free-text notes** saved to `feedback/meta-<patch>.md` for Claude. Not reset per patch. |
| D63 | Power v2 | Power multiplier keeps **all three terms** (curated + raw WR + rating, D36) on top of the simulation. |
| D64 | Items v2 | The **simulation optimizes items** greedily per purchase (candidates: ARAMKit items for the champion/augments + model synergies); buy order matters through gold timing. |
| D65 | Old rules | Synergy rules / curated combos are **retired for G/C** and keep only their F part; the "Why" panel is generated from the simulation. |
| D66 | D45 updated | Simulated clashes **may lower** the score (it's the mechanics); the conflict warnings stay. |
| D67 | Validation | Calibrate the normal-player simulation against ARAMKit per-game numbers (gold, damage by type, damage taken, duration) with a misfit report in `data/reports/`, plus a spot-check pack of famous builds' curves. **No midway checkpoint** (D38). |
| D68 | Sim UI | Build panel: **curve chart** of advantage over time per output + key numbers at a few minutes; ranked rows: hover mini curve. |
| D69 | Knobs | Settings in **player language**: game length (short ↔ long), snowball (barely ↔ a lot), growth shape (raw power ↔ exponential), enemy chips (D62). Planner default **1–3 s accurate** (rank with fixed items, re-optimize top ~40); **"Exact mode"** switch = whatever it takes. |
| D70 | Live timer | Live has a **"Start match"** button; the elapsed time is the current minute, and the simulation evaluates the rest of the game from there with the owned items. |
| D71 | ARAM modifiers | Unknown to the user whether Mayhem uses ARAM per-champion balance modifiers: **research** (game files / wiki), apply what Mayhem uses, document the source. |
| D72 | Generic builds | **No penalty** for generic packages that top many champions (user: "no change"). |
| D73 | Delivery v2 | UI batch first (commit + push), simulation committed at milestones, pushed when complete. |

## Open questions

Requirements are settled. Resolved: rarity odds (ARAMKit), eligibility (observed, D48), sets
(removed in 26.12), stat anvil options (map12 `AnvilData`), win-rate source (ARAMKit raw WRs).
Still open (currently estimates, see "Known limitations"):
- 5th slot mechanics (D16); Golden Reroll chance; offer weights within a pool; anvil tier odds.
- The user's answers to `curation/SPOTCHECK.md` (asked at the end of the v1 build).

## Domain notes

- Riot internal codenames: **KIWI = ARAM: Mayhem**, **KIWI_JADE = a second Mayhem augment pool
  (tied to a "Jade" map variant — unconfirmed)**, **CHERRY = Arena**.
- Mayhem rules (Riot support page May 2026 + LoL wiki, 2026-10-18):
  - Rarities Silver / Gold / Prismatic; every player gets the **same rarity per screen**, random
    each time; screens 1 and 2 cannot both be Silver. Prismatic said to enter at level 11 (guide).
  - Selection screens at champion levels **3 (game start), 7, 11, 15**; 3 cards each; only
    choosable while dead/in shop range (missed screens queue up).
  - **Each card can be rerolled once** (same tier, different augment) → up to 6 seen per screen.
  - **An augment once offered is never offered again** that game.
  - **Golden Reroll** (track milestone 1): on Silver/Gold screens, sometimes one card can be
    rerolled one tier up. No published percentage.
  - 4 slots from screens + a **5th slot** for "a select few special augments" (unidentified).
  - Quests: some augments need a quest completed to reach full power.
  - Runes disabled; summoner spells allowed except Exhaust.
  - **Stat Anvil** (consumable, level 9+, 750 g in patch 25.23; Silver/Gold/Prismatic): opening
    gives a choice of 1 of 3 stats; stat shard values match Arena except Move Speed (15%); each
    purchase grants a free Cappa Juice. `ARAM_HighRoller` augment drops anvils; a "Gamble" set
    uses anvil orbs.
  - **Augment sets** (since patch 26.3): 9 sets with 2–4-piece bonuses (TFT-trait-like), e.g.
    Snowday, Make it Rain, Archmage, Deathknell, Firecracker/Fireworks.
- **Mayhem Progression Track** (the user calls it "the battle pass"): 32 account milestones,
  persistent across games. Gameplay-relevant milestones: 1 Golden Reroll · 2 Pat on the Back ·
  4 Forged by the Master · 6 Shark Bait · 8 Hellbent · 9 Ability Augment+ (higher chance of an
  ability augment at game start) · 10 Shark Tempest · 12 Spirit Bomb · 14 Nature is Healing ·
  16 Surge Field · 18 Tooth Fairy · 20 Squishy Slappy Grab · 22 Endless Decimation · 24 DropBear ·
  26 Snowblast! · 28 Ult Bot · 30 Poro Stampede · 32 Dimension Shift (the rest are cosmetics).
  Augments named at a milestone are **locked until reached**; a newly unlocked one (non-Silver)
  is guaranteed in the next match if it fits the draft.
- Some augments are quests (12 quests in data), some are "ability augments" (modify Q/W/E/R),
  some upgrade items (`Upgrade_*`), and there seem to be augment **sets** with set bonuses
  (UI files `kiwiaugmentsettooltips`, `kiwiaugmentsettraittracker` exist).

## Data sources found (2026-10-18, game data version 16.20 / patch 26.20)

| Source | URL | What it gives |
|---|---|---|
| CDragon augment lists | `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/augment-lists.json` | Augment IDs per mode: `CHERRY` 57, `KIWI` 223, `KIWI_JADE` 188 |
| CDragon cherry-augments | `.../v1/cherry-augments.json` | 554 augments (all modes): numeric id, nameId, display name, icon, rarity (`kSilver`/`kGold`/`kPrismatic`/`kEventChoice`) |
| CDragon kiwi bin | `https://raw.communitydragon.org/latest/game/maps/modespecificdata/kiwi.bin.json` (~12 MB) | 223 `AugmentData` entries: name/description/tooltip string keys, `RootSpell` + `AdditionalSpells` (spell objects carry the numbers), `rarity` (0/absent, 1, 2), `mAugmentTags` and `mBuildTags` bitfields (meaning not yet decoded), `IsAbilityAugment`, `QuestData`, `Enabled:false` on disabled ones; also 12 `ModesQuestData` |
| CDragon jade bin | `.../modespecificdata/jade.bin.json` | Jade variant data |
| CDragon string tables | `game/en_us/data/menu/en_us/lol.stringtable.json` (path to verify) | Resolves the `*Tra` keys into English text |
| CDragon file index | `https://raw.communitydragon.org/latest/cdragon/files.exported.txt` | Full file list for finding other bins |
| CDragon arena JSON | `https://raw.communitydragon.org/latest/cdragon/arena/en_us.json` | Arena only — contains **no** Mayhem augments |
| LoL wiki | `https://wiki.leagueoflegends.com/en-us/ARAM_Mayhem/Augments`, `Module:MayhemAugmentData/data` | Curated list/descriptions; blocks curl with a bot challenge (needs a browser) |
| Community stats | arammayhem.com (per-champion combos, patch notes), u.gg, mobalytics | Pick/win rates, tier lists |

Local tooling available: Python 3.12, Node 20.12 / npm 10.5, git 2.47.

## File layout

```
CLAUDE.md                 this index (read first)
README.md                 user-facing overview + run commands
run.sh                    one-command start (D50): npm install if needed, dev server, open browser
pipeline/                 Python 3.12, stdlib only; run scripts with `python -I`
  common.py               paths, download helpers (gzip), locale table (en -> en_us, es -> es_es)
  fetch.py                raw game data -> data/raw/<game version>/ (+ data/raw/CURRENT)
  fetch_community.py      ARAMKit + u.gg community stats -> data/raw/<version>/community/
  render.py               tooltip engine: string tables (plain + xxh64-hashed keys), {{includes}},
                          @placeholders@ (incl. @spell.X:Var@), spell calculation evaluator, stat ids
  profiles.py             champion profile attributes (0-1) + flags; ability-augment slot inference
  community.py            per-champion eligibility/stats/builds + rarity odds from raw community data
  build.py                raw -> app/public/data/*.json (+ champstats/) + data/reports/build-<v>.txt
  update.py               one-command patch update + data/reports/diff-<old>-to-<new>.md
curation/                 hand-authored data (version-controlled) — the formula's knowledge
  taxonomy.json           22 primary augment types + assignment (approved, D47)
  augments.json           per augment: mechanic tags, g/c/f potential 0-10, power p, timing, boosts
  vocabulary.json         tag -> champion attribute map used for fit
  synergy.json            pairwise tag rules, curated combos, conflicts (warnings), exclusions
  champions.json          special champion flags + attribute overrides
  items.json              item mechanic tags (+ special Mayhem quest items)
  track.json              Mayhem Progression Track milestones -> locked augment ids
  SPOTCHECK.md            spot-check pack for the user (D39)
app/                      React 18 + Vite 5 + TypeScript; `npm run dev` (port 5173)
  vite.config.ts          includes the local feedback API (/api/feedback, /api/tuning -> ../feedback)
  src/engine/             formula + probabilities, no DOM (also used by scripts/)
    types.ts data.ts score.ts odds.ts search.ts items.ts anvils.ts settings.ts
    leaderboard.ts        live re-weighting of precomputed builds (D52), combo rows
  src/views/              Planner (+ BuildPanel, RankedList), Live, Encyclopedia, Leaderboard,
                          Settings, Feedback, common.tsx
  src/components/         Hover.tsx (nested hover cards), RichText.tsx (game markup), cards.tsx,
                          Sort.tsx (sortable headers / sort bars, D54)
  src/i18n.ts             UI strings en/es + type names
  scripts/precompute.ts   leaderboards/ceilings -> public/data/leaderboard.json (npm run precompute)
  scripts/smoke.ts        engine smoke test: `npx tsx scripts/smoke.ts Veigar`
  public/data/            generated data (committed, ~17 MB)
feedback/                 rated builds + tuning.json (written by the dev server, D8)
data/raw/                 raw downloads (gitignored, ~130 MB game + ~700 MB community per patch)
data/reports/             build QA reports and patch diffs
```

### Generated data (app/public/data)

- `augments.json`: per augment: `id` (AugmentNameId), `rarity` silver/gold/prismatic,
  `enabled`, `name`/`summary`/`tooltip` `{en,es}` (numbers rendered), icons, `buildTags`/
  `augmentTags` (raw ints + hypothesised names), `displayTags`, `isAbility`, `quest`
  (milestones), `trackMilestone`, `fallbackPool`, `linkedItems`, `grantsAbilities`
  (`Champ:Slot`), `abilityRefs` (slots mentioned), `summonerRefs`, `values` (DataValues).
  Ability augments contain `<spellRef></spellRef>` where the chosen ability's name goes.
- `champions.json`: id/alias, `key`, names/titles, roles, attack/damage type, playstyle, champion
  tags, `purchaseIdentities` (Melee/Ranged), `resource` (arType), base `stats`, `abilities`
  P/Q/W/E/R with `tooltip {en,es}`, cooldown/cost per rank, `traits` (`Trait_*` spell tags).
- `anvils.json`: 37 Stat Anvil shard options: tiers, tooltip, tags.
- `items.json` (map 12, Data Dragon; `cur` = merged item tags), `summoners.json` (modes incl.
  KIWI), `draft.json` (cards per screen, fallback pools, display tags, selection levels),
  `meta.json`, `track.json`, `synergy.json`, `vocabulary.json` (copies of curation),
  `odds.json` (ARAMKit rarity per stage + transitions + sequences), `eligibility.json`
  (augment → champions), `champstats/<Champion>.json` (eligible {aug: stages}, raw `wr`
  [winRate, pickRate, samples], `stageWr`, top `pairs`, `items`, `archetypes`, per-augment
  `builds` with top items and purchase order), `leaderboard.json` (precompute: per champion
  top-3 builds + `axisBest` {g,c,f} = build maximizing power × that axis, each tagged `found`;
  `reference` = 95th percentile ceiling used as score 100; combo rows are derived in the app).
- Augments also carry `cur` (merged curated data, `p` seeded from global WR when not curated),
  `type` (taxonomy), `global` (ARAMKit stats), `eligibleCount`, `stages`. Champions carry
  `profile` (0-1 attributes), `flags`, `abilityAugmentSlots`, abilities with `scalings`.

## Formula (as implemented, see app/src/engine/score.ts)

- craziness = power × (wG·G + wC·C + wF·F)/(wG+wC+wF); display score = craziness /
  leaderboard reference × 100 (can exceed 100).
- G/C/F = Σ augment base (curated g/c/f) × fit × timing + Σ items' small base + anvil shards
  + Σ pairwise synergy rules (scaled by √(fitA·fitB); ×0.5 with an item, ×0.25 item–item)
  + curated combos + off-role F bonus (augment archetype ∉ champion roles, fit ≥ 0.5).
- fit = geometric mean over hooked attributes of (0.3 + 0.7·attr) × champion-flag boosts;
  ability augments × slot quality (cooldown-based, R uses `ult`).
- timing (whole-game curve, D33): screens at minutes 0/5/9.5/14 of a 17.5-min game; stack
  0.35+0.65·left, quest 0.3+0.7·left, flat 0.8+0.2·left, late/instant 1.
- power = clamp(curated + a·(raw WR − 0.5) + b·(rating − 5.5)/4.5, 0.2, 2); curated =
  mean(p)·(0.6+0.4·mean fit) in [0.3, 1.5]; WR = mean of champion-specific raw WRs of the
  build's augments (+ observed pair WRs, double weight).
- Ranking (search.ts): now = evaluate(build + candidate); best case = greedy best follow-ups
  on later screens (best luck), using follow-up gains vs the current build + exact pairwise
  synergy with the candidate; expected = Σ later screens Σ rarity P(rarity) × E[best of ~6 seen
  cards] × 0.85. Leaderboards use a full beam search (width 8) with fixed champion items, once for
  craziness and once per axis (objective power × axis); ~2.5 min for all champions.
- Probabilities (odds.ts, all estimates): ARAMKit rarity chain; eligible pool = observed per
  champion and screen, minus picked/excluded/locked-by-track; 3 cards + 1 reroll each → P(seen)
  = 6/n; ability augment slot uniform; Golden Reroll 20% (estimate); anvil tier odds 60/30/10
  (estimate); build probability sums over screen assignments and orders.
- Best build (items.ts): candidates and value from ARAMKit items conditional on each augment
  (+ champion baseline) blended with tag synergy; boots + 5 legendaries; ARAMKit purchase order.

## Known limitations / estimates

- Offer weights within a pool are assumed uniform (Riot's are unpublished; patch 26.14 says
  RNG reduces repeated offer types).
- 5th augment slot mechanics unknown; Transmute-style extras can be added as "Extra".
- Stat ids 22, 23, 34 in tooltips are unlabelled ("stat 34" ≈ heal/shield power?).
- Augment sets were removed in 26.12 (D44's set bonuses do not exist in the current patch).
- The wiki blocks scripted access; use WebFetch for it. The Chrome extension was not connected
  on 2026-10-18; UI checks used playwright-core + local Chrome from the scratchpad.



## Technical findings (for the next session)

- **Tooltip engine**: `mStat` ids (inferred): 0 AP, 1 Armor, 2 AD, 4 AS, 5 MPen, 6 MR, 7 MS,
  8 Crit chance, 9 Crit damage, 10 Haste, 12 max HP, 13/16 missing HP, 14 current HP,
  18 life steal/omnivamp, 29 lethality, 31 attack range. `mStatFormula` 1 base, 2 bonus.
  DataValues index = rank (index 0 unused); `mana` arrays are 0-based per rank. Bin names are
  FNV-1a32 hashed (`{xxxxxxxx}`), string-table keys xxh64 (40-bit, `{xxxxxxxxxx}`).
  Verified against known abilities (Annie Q, Garen R, Ahri R, Jinx W, Nasus Q).
- **Augment draft config** lives in `map12.bin.json` object `{a095d094}`: 3 cards per rarity,
  fallback pools per rarity (always-eligible augments). **Rarity-per-round odds are not
  client-side** (server).
- **Champion eligibility is server-side.** Clues: `mAugmentTags` behave like requirement tags
  (mana, ranged, ultimate, heal/shield, support, summoner-slot replacers...), `mBuildTags` like
  build archetypes (assassin, enchanter, fighter, mage, marksman, artillery, tank, crit,
  autocast, spellcaster). Anvil shard options carry the same tags. Ability augments (30,
  `IsAbilityAugment`) attach to one champion spell; eligibility likely follows spell `Trait_*`
  tags (Trait_Shield → Bolstered, Trait_KnockBack → Chain Reaction, Trait_CreateTerrain →
  Terrain'd, ...). Patch 26.12–26.13 pruned 450+ poor-fit champion+spell combos.
- **Augment sets were removed in patch 26.12** (wiki "ARAM: Mayhem/Old content"); some set
  effects became standalone augments (Stackosaurus Rex, Snowday, Archmage, High Roller, Wee Woo
  Wee Woo). So D44's "set bonuses" do not apply in the current patch.
- Wiki notes (Module:MayhemAugmentData, via WebFetch — the wiki blocks curl): Perseverance and
  Vampirism exclude each other; Vampirism not offered with Warmog's; Draw Your Sword ranged-only
  and not with Runaan's; Earthwake max 2 per team; Poro Blaster 1 per team; summoner-slot
  replacers (Blade Waltz, Dimension Shift, Growth Spurt, Empyrean Promise, Flash 2, Flashbang,
  Flashy, Biggest Snowball Ever, Holy Snowball, Clown College).
- **Community data (fetched by `pipeline/fetch_community.py`)**:
  - **ARAMKit** (aramkit.com; static JSON on `data.aramkit.com/<dataPath>/stats/all/`, dataPath
    read from the site's Nuxt config `aramKitDataVersions`): `augment-rarity.json` (rarity odds per
    stage, stage→stage transitions, 81 four-stage sequences; 16.20: stage 1 = 10.9% S / 60.5% G /
    28.7% P, later stages ≈ 29.3/44.2/26.5 with transitions), `champion-details/<key>.json`
    (per champion: augments all + per stage with winRate/pickRate/sampleCount/`availableStages`,
    top augment pairs, items per slot, build archetypes), `<key>-single-augments.json` (items and
    builds conditional on each augment: input for the best-build scenario, D25), rankings.
    ~36.7M games for 16.20.
  - **u.gg** (static.bigbrain.gg/custom-aram-mayhem/<patch>/): per-champion observed augment
    lists by rarity (`tierlist-augments-<key>-<patch>.json`), manifest, champion tiers.
  - The two sources agree on per-champion augment counts (e.g. Ezreal 130 of 216 enabled).
- **Eligibility finding (D17)**: champion eligibility is server-side; requirement bits only
  partly explain it, but the observed matrix shows clean classes (e.g. the 5 armor/MR-scaling
  augments appear for exactly the same 85 champions; AP augments ~102–105; support ones ~20).
  Current plan: eligibility = observed per champion and per stage (ARAMKit, cross-checked with
  u.gg); ability-augment → spell assignment inferred from `Trait_*` spell tags.
- **Stage availability**: augments have stage restrictions (e.g. Pursuit of Power only stages
  1–2, Bread and Butter only 2–4) — ARAMKit `availableStages`.
- arammayhem.com: per-champion "appearance rate" for top augments, curated combo notes (HTML).
