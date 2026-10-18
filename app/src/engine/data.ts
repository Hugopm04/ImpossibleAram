import type { Augment, Champion, ChampStats, GameData, Item } from "./types";

export type JsonReader = (name: string) => Promise<unknown>;

/** Load all static game data. `read` fetches `data/<name>` (browser) or reads it from disk (Node). */
export async function loadGameData(read: JsonReader): Promise<GameData> {
  const names = ["meta", "augments", "champions", "items", "anvils", "summoners", "odds", "synergy",
    "vocabulary", "track", "eligibility", "draft"] as const;
  const loaded = await Promise.all(names.map((n) => read(`${n}.json`)));
  const d = Object.fromEntries(names.map((n, i) => [n, loaded[i]])) as Record<(typeof names)[number], any>;
  const augments = d.augments as Augment[];
  const champions = d.champions as Champion[];
  const items = d.items as Item[];
  const leaderboard = await read("leaderboard.json").catch(() => null);
  return {
    leaderboard: leaderboard as GameData["leaderboard"],
    meta: d.meta,
    augments,
    augmentById: new Map(augments.map((a) => [a.id, a])),
    champions,
    championById: new Map(champions.map((c) => [c.id, c])),
    items,
    itemById: new Map(items.map((i) => [i.id, i])),
    anvils: d.anvils,
    summoners: d.summoners,
    odds: d.odds,
    synergy: d.synergy,
    vocabulary: d.vocabulary,
    track: d.track,
    eligibility: d.eligibility,
    draft: d.draft,
  };
}

const statsCache = new Map<string, Promise<ChampStats | null>>();

export function loadChampStats(read: JsonReader, champion: string): Promise<ChampStats | null> {
  if (!statsCache.has(champion)) {
    statsCache.set(champion, read(`champstats/${champion}.json`).then((x) => x as ChampStats).catch(() => null));
  }
  return statsCache.get(champion)!;
}

export const browserReader: JsonReader = async (name) => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
};
