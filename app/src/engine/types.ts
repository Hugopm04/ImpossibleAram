// Data shapes produced by pipeline/build.py (app/public/data/*.json).

export type Loc = "en" | "es";
export type Text = Record<Loc, string>;
export type Rarity = "silver" | "gold" | "prismatic";
export type Slot = "P" | "Q" | "W" | "E" | "R";
export type Timing = "flat" | "stack" | "quest" | "late" | "instant";

export interface Curated {
  t: string[];
  g: number;
  c: number;
  f: number;
  p: number;
  time: Timing;
  boost: Record<string, number>;
}

export interface Quest {
  id: string;
  name: Text;
  milestones: { target: number; text: Text }[];
  completeText: Text;
}

export interface Augment {
  id: string;
  platformId: number;
  rarity: Rarity;
  enabled: boolean;
  name: Text;
  summary: Text;
  tooltip: Text;
  icon: string | null;
  iconSmall: string | null;
  buildTags: number;
  buildTagNames: string[];
  augmentTags: number;
  augmentTagNames: string[];
  displayTags: Text[];
  isAbility: boolean;
  quest: Quest | null;
  trackMilestone: number | null;
  fallbackPool: Rarity | null;
  linkedItems: string[];
  grantsAbilities: string[];
  abilityRefs: Slot[];
  summonerRefs: string[];
  values: Record<string, number>;
  type: string;
  cur: Curated;
  global: { winRate: number; pickRate: number; samples: number; tier: string; stages: number[] } | null;
  eligibleCount: number;
  stages: number[];
}

export interface Ability {
  slot: Slot;
  script: string;
  name: Partial<Text>;
  short: Partial<Text>;
  tooltip: Text;
  icon: string | null;
  ranks: number;
  cooldown: string;
  cost: string;
  cooldownValues: number[];
  castRange: number;
  traits: string[];
  scalings: Record<string, number>;
}

export interface Champion {
  id: string;
  key: number;
  name: Partial<Text>;
  title: Partial<Text>;
  icon: string;
  roles: string[];
  attackType: string;
  damageType: string;
  tags: string[];
  tagNames: Partial<Record<Loc, (string | null)[]>>;
  purchaseIdentities: string[];
  resource: number;
  stats: Record<string, number>;
  abilities: Ability[];
  profile: Record<string, number>;
  flags: string[];
  hasStats: boolean;
  abilityAugmentSlots: Record<string, Slot[]>;
}

export interface Item {
  id: string;
  name: Text;
  description: Text;
  plaintext: Text;
  gold: { base?: number; total?: number; sell?: number; purchasable?: boolean };
  tags: string[];
  stats: Record<string, number>;
  from: string[];
  into: string[];
  depth: number;
  inStore: boolean;
  requiredChampion?: string | null;
  requiredAlly?: string | null;
  icon: string;
  cur: { t: string[]; g: number; c: number; f: number };
  special: boolean;
}

export interface Anvil {
  id: string;
  tiers: Rarity[];
  name: Text;
  tooltip: Text;
  icon: string | null;
  buildTags: number;
  buildTagNames: string[];
  augmentTags: number;
  augmentTagNames: string[];
  values: Record<string, number>;
}

export interface Summoner {
  id: string;
  name: Text;
  description: Text;
  cooldown: string;
  icon: string;
}

export interface ChampStats {
  eligible: Record<string, number[]>;
  wr: Record<string, [number, number, number]>;
  stageWr: Record<string, Record<string, [number, number]>>;
  pairs: [string, string, number, number][];
  items: [string, number, number, number][];
  archetypes: Record<string, number>;
  champion: { winRate: number; pickRate: number; samples: number; tier: string; rank: number };
  builds: Record<string, {
    items: [string, number, number, number][];
    order?: string[];
    boots?: string | null;
    archetype?: string;
    orderWr?: number;
    orderN?: number;
  }>;
}

export interface Odds {
  source?: string;
  stages: Record<string, Record<Rarity, number>>;
  transitions: Record<string, Record<Rarity, Record<Rarity, number>>>;
  sequences: { rarities: Rarity[]; p: number }[];
}

export interface SynergyRule {
  a: string;
  b: string;
  g?: number;
  c?: number;
  f?: number;
  x?: number;
  why: string;
}

export interface Synergy {
  rules: SynergyRule[];
  combos: { a: string; b: string; g?: number; c?: number; f?: number; why: string }[];
  conflicts: { a: string; b: string; why: string }[];
  exclusions: { a: string; b?: string; item?: string; why: string }[];
}

export interface Vocabulary {
  floor: number;
  defaultFit: number;
  hooks: Record<string, string>;
}

export interface Track {
  maxMilestone: number;
  effects: { milestone: number; effect: string; note: string }[];
  milestones: { milestone: number; augments: string[] }[];
}

export interface Meta {
  gameVersion: string;
  ddragonVersion: string;
  patch: string;
  builtAt: string;
  counts: Record<string, number>;
  communitySources: { aramkit: string | null; ugg: boolean };
}

export interface LeaderboardBuild {
  picks: Pick[];
  items: string[];
  craziness: number;
  axes: { g: number; c: number; f: number };
  power: number;
  probability: number;
  highlights: { a: string; b?: string; why?: string }[];
}

export interface Leaderboard {
  builtAt: string;
  patch: string;
  reference: number;
  settings: { weights: Settings["weights"]; milestone: number };
  champions: { id: string; best: LeaderboardBuild; top: LeaderboardBuild[]; expected: number; expectedFirst?: string }[];
  combos: (LeaderboardBuild & { champion: string })[];
}

export interface GameData {
  leaderboard: Leaderboard | null;
  meta: Meta;
  augments: Augment[];
  augmentById: Map<string, Augment>;
  champions: Champion[];
  championById: Map<string, Champion>;
  items: Item[];
  itemById: Map<string, Item>;
  anvils: Anvil[];
  summoners: Summoner[];
  odds: Odds;
  synergy: Synergy;
  vocabulary: Vocabulary;
  track: Track;
  eligibility: Record<string, string[]>;
  draft: { cardsPerScreen: Record<Rarity, number>; fallbackPools: Record<string, string[]>; selectionLevels: number[] };
}

// ---------------------------------------------------------------- build state

export interface Pick {
  aug: string;
  stage: number; // 1..4 = selection screens; 0 = granted extra (Transmute etc.)
  slot?: Slot; // ability augments: the ability it attaches to
}

export interface AnvilPick {
  tier: Rarity;
  shard?: string; // chosen shard (anvil id) if known
}

export interface Build {
  champion: string;
  picks: Pick[];
  anvils: AnvilPick[];
  lockedItems: string[]; // items the player already owns (live mode)
}

export interface Settings {
  weights: { g: number; c: number; f: number };
  a: number; // win-rate term weight (D36)
  b: number; // feedback-rating term weight (D36)
  milestone: number; // Mayhem progression track milestone (D19)
  locale: Loc;
  sortBy: "best" | "expected" | "now" | "probability";
}

export interface FeedbackEntry {
  date: string;
  champion: string;
  augments: { id: string; stage: number; slot?: Slot }[];
  items: string[];
  overall?: number;
  axes?: { g?: number; c?: number; f?: number; power?: number };
  comment?: string;
  computed: { craziness: number; g: number; c: number; f: number; power: number };
  patch: string;
}
