# Feedback files

Written by the app's dev server when a build is rated (decision D8 in `CLAUDE.md`).

- `<timestamp>-<Champion>.json`: one rated build:
  `champion`, `augments` (`id`, `stage`, `slot`), `items`, optional `overall` (1–10),
  optional `axes` (`g`, `c`, `f`, `power` = "did it work", 1–10), optional `comment`,
  `computed` (the model's craziness / G / C / F / power at rating time), `patch`.
  Stat Anvils are not recorded.
- `tuning.json`: weights auto-tuned from per-axis ratings (`weights`, `a`, `b`, `history`).

How they are used:
1. **Live**: `overall` feeds the power factor's rating term for the same or similar builds
   (`b·(rating − 5.5)/4.5`, similarity ≥ 50% of shared augments); per-axis ratings nudge the
   G/C/F weights.
2. **Refinement by Claude** (in a later session): read every file here, compare `computed` with
   the ratings and comments, adjust `curation/*.json` (tags, G/C/F, synergy rules, combos), rebuild
   (`python -I pipeline/build.py`, then `npm run precompute` in `app/`) and record what changed
   in `CLAUDE.md`.
