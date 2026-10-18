# Spot-check pack (D39)

Generated 2026-10-18 for patch 26.20. Purpose: let the user spot-check the curated layer
(curation/augments.json, synergy.json, champions.json) where it matters most. Feedback from games
refines the rest (D8). Scores below use default weights G40/C35/F25 and milestone 32.

## Highest curated Growth (G)

Steel Your Heart 9, Phenomenal Evil 9, Infinite Recursion 8, Soul Eater 8, Infernal Conduit 7, Master of Duality 7, Slap Around 7, Tank Engine 7, Tap Dancer 7, Tooth Fairy 7, Pressure Cooker 7, Eureka 6

## Highest curated No counterplay (C)

Can't Touch This 7, Divine Intervention 7, Upgrade Zhonya's 6, Fey Magic 6, Blade Waltz 6, Dimension Shift 6, Rite of Ascension 6, Hellbent 6, Courage of the Colossus 5, Ice Cold 5, Wooglet's Witchcap 5, Scopiest Weapons 5

## Highest curated Fun (F)

DropBear 10, Shark Bait 10, Poro Stampede 10, Dimension Shift 10, Pandora's Box 9, Spin Me Right Round 9, Dropkick 9, Prom Queen 9, Squishy Slappy Grab 9, Clown College 9, Mad Scientist 8, Urf's Champion 8

## Curated power vs real win rate (largest disagreements)

Curated power `p` was seeded from the global ARAMKit win rate; these are where p and WR differ most.

| Augment | p | global WR | games |
|---|---|---|---|
| King Me | 0.60 | 31.9% | 1,026,455 |
| Critical Healing | 0.98 | 49.2% | 1,186,075 |
| Leg Day | 1.00 | 50.0% | 7,283,426 |
| Tank Engine | 1.02 | 50.7% | 18,027,356 |
| Upgrade Infinity Edge | 1.00 | 49.9% | 15,180,599 |
| Erosion | 1.03 | 51.0% | 5,329,446 |
| Steel Your Heart | 1.07 | 52.2% | 12,941,214 |
| Transmute: Chaos | 0.97 | 49.0% | 9,214,580 |
| Shrink Ray | 0.89 | 46.2% | 4,029,670 |
| Stats on Stats on Stats! | 0.97 | 49.0% | 2,221,476 |

## Augments that dominate champion ceilings

How many of the 173 champions have the augment in their best build. Very high counts may mean the
augment's curated G/C/F is too generous (or it really is the craziest thing in the mode).

Eureka 45, Steel Your Heart 44, With Haste 43, Phenomenal Evil 38, Ult Bot 34, Can't Touch This 34, Ultimate Revolution 33, Pressure Cooker 31, Archmage 29, Dual Wield 23, Fan The Hammer 20, Skilled Sniper 19, Ultimate Awakening 17, Infinite Recursion 16, Tank Engine 16

## Sample champion ceilings

| Champion | Best build | Score points | Odds |
|---|---|---|---|
| Veigar | Stackosaurus Rex + Phenomenal Evil + Eureka + Big Brain | 47.1 | 1 in 11,898 |
| Sion | Steel Your Heart + Stackosaurus Rex + With Haste + Goliath | 58.7 | 1 in 24,662 |
| Jinx | From Downtown + Skilled Sniper + Dual Wield + Mystic Punch | 36.4 | 1 in 6,439 |
| Malphite | Ultimate Revolution + Ult Bot + Can't Touch This + Final Form | 39.7 | 1 in 98,123 |
| Soraka | Circle of Death + Ult Bot + Ultimate Revolution + Can't Touch This | 34.1 | 1 in 48,097 |
| Yasuo | Ult Bot + Ultimate Revolution + Can't Touch This + Final Form | 42.8 | 1 in 88,075 |
| Ezreal | Infinite Recursion + Archmage + Magic Missile + Skilled Sniper | 34.7 | 1 in 13,755 |
| Katarina | Ult Bot + Can't Touch This + Ultimate Revolution + Final Form | 41.2 | 1 in 88,075 |
| Thresh | Steel Your Heart + With Haste + Mind to Matter + Heavy Hitter | 46.7 | 1 in 13,301 |
| Zyra | Eureka + Phenomenal Evil + Archmage + Skilled Sniper | 37.0 | 1 in 7,952 |
| Master Yi | Ultra Hydra + Dual Wield + Fan The Hammer + Tap Dancer | 30.0 | 1 in 127,834 |
| Nasus | Stackosaurus Rex + Steel Your Heart + With Haste + Heavy Hitter | 46.4 | 1 in 39,503 |

## Questions for the user

1. Do the top builds above feel like the craziest things you have seen in Mayhem? Which ones are wrong?
2. 'With Haste' / 'Steel Your Heart' tanks dominate the leaderboard: right, or too generous?
3. Ultimate spam (Ult Bot + Ultimate Revolution + Can't Touch This) is the default ceiling for many
   champions: should C (no counterplay) for invulnerability be lower?
4. Any augment whose G/C/F potential (encyclopedia columns) looks clearly off?
