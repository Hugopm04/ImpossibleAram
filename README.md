# ImpossibleAram

A local tool for finding the craziest champion + augment combinations in League of Legends
**ARAM: Mayhem**: fast exponential growth, almost no counterplay, funny or extravagant.

> Project index, decisions and status for contributors (and future Claude sessions) live in
> [CLAUDE.md](CLAUDE.md).

## Requirements

- Python 3.12+ (data pipeline, standard library only)
- Node 20+ (web app)

## Data pipeline

```bash
python -I pipeline/fetch.py     # download raw game data for the current patch -> data/raw/<version>/
python -I pipeline/build.py     # build bilingual app data -> app/public/data/*.json
```

`fetch.py` reuses files already downloaded (`--force` re-downloads). `build.py` writes a QA report
to `data/reports/build-<version>.txt` listing any tooltip placeholders it could not resolve.

Sources: [CommunityDragon](https://raw.communitydragon.org) (game files, string tables) and
[Data Dragon](https://ddragon.leagueoflegends.com) (items, summoner spells).
