# ImpossibleAram

A local tool for finding the craziest champion + augment combinations in League of Legends
**ARAM: Mayhem**: fast exponential growth, almost no counterplay, funny or extravagant.

> Project index, decisions and status for contributors (and future Claude sessions) live in
> [CLAUDE.md](CLAUDE.md).

## What it does

- **Planner**: pick a champion and see every augment you can be offered on the next screen, ranked
  by craziness given the augments you already have. Each row shows the score now, in the best case
  (best follow-ups with the best luck), and expected (optimal play, real odds). It also shows the
  probability of being offered the augment, the probability of the best case, and the best item
  build for that situation. Stat Anvils appear as special entries with a per-shard breakdown.
- **Hover anything**: augments show their description with the real numbers. Items and champion
  abilities they mention open their own cards, nested as deep as you like (click to pin).
- **Live**: type in the cards you are offered (and reroll results) to get pick and reroll advice.
- **Augments**: an encyclopedia of all augments with filters.
- **Craziest combos / Champion ceilings**: precomputed leaderboards across all champions.
- **Feedback**: rate a build (overall, per axis, comment). Ratings tune the formula weights and
  are saved to `feedback/` for later refinement.
- English and Spanish (game texts from the official localizations).

## Requirements

- Node 20+ (web app)
- Python 3.12+ (data pipeline, standard library only), only needed to refresh data

## Run the app

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

The generated data is committed (`app/public/data/`), so the app runs without the pipeline. The
feedback buttons need `npm run dev`, because the dev server writes the files.

## Refresh data for a new patch

```bash
python -I pipeline/update.py      # fetch + community stats + build + diff report + leaderboards
```

Or step by step:

```bash
python -I pipeline/fetch.py              # raw game data -> data/raw/<version>/ (~130 MB, gitignored)
python -I pipeline/fetch_community.py    # ARAMKit + u.gg stats -> data/raw/<version>/community/ (~700 MB)
python -I pipeline/build.py              # bilingual app data -> app/public/data/*.json
cd app && npm run precompute             # leaderboards -> app/public/data/leaderboard.json
```

`build.py` writes a QA report to `data/reports/build-<version>.txt`. `update.py` writes
`data/reports/diff-<old>-to-<new>.md`, which lists new or changed augments that need curation.

## Data sources

- [CommunityDragon](https://raw.communitydragon.org): game files and string tables (augments,
  champions, abilities, numbers).
- [Data Dragon](https://ddragon.leagueoflegends.com): items and summoner spells.
- [ARAMKit](https://aramkit.com) and [u.gg](https://u.gg): which augments each champion actually
  gets, win rates, rarity odds, builds per augment.

Probabilities are estimates (Riot does not publish offer weights) and are marked "est." in the UI.
ImpossibleAram is a fan project, not endorsed by Riot Games.
