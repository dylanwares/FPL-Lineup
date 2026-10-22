import type { KitStyle } from "@/config/kits";

/**
 * The on-the-wire bootstrap file. Columnar (one array per field) so it gzips
 * well and decodes in a single pass. Bump BOOTSTRAP_FORMAT on breaking changes;
 * clients discard cached files with a different format.
 *
 * Conventions: money in tenths of £1m, epoch times in seconds, -1 for "none".
 */
export const BOOTSTRAP_FORMAT = 2;

/**
 * Season stats carried per player, each with its integer scale on the wire
 * (stored as round(value × scale)). Set-piece orders are 0 when the player
 * isn't on the list. Adding a stat here adds a column end to end.
 */
export const STAT_SCALES = {
  minutes: 1,
  starts: 1,
  goals: 1,
  assists: 1,
  cleanSheets: 1,
  goalsConceded: 1,
  ownGoals: 1,
  penaltiesSaved: 1,
  penaltiesMissed: 1,
  yellowCards: 1,
  redCards: 1,
  saves: 1,
  bonus: 1,
  bps: 1,
  defCon: 1,
  cbi: 1,
  recoveries: 1,
  tackles: 1,
  dreamteam: 1,
  xg: 100,
  xa: 100,
  xgi: 100,
  xgc: 100,
  ppg: 10,
  ict: 10,
  influence: 10,
  creativity: 10,
  threat: 10,
  /** Transfers in/out this gameweek. */
  transfersIn: 1,
  transfersOut: 1,
  /** Price change in tenths of £1m, this gameweek and since the season started. */
  priceChangeGw: 1,
  priceChangeStart: 1,
  penOrder: 1,
  cornerOrder: 1,
  fkOrder: 1,
} as const;

export type StatKey = keyof typeof STAT_SCALES;
export const STAT_KEYS = Object.keys(STAT_SCALES) as StatKey[];

export interface BootstrapFile {
  format: typeof BOOTSTRAP_FORMAT;
  season: string;
  generatedAt: number;
  currentGw: number | null;
  nextGw: number | null;
  /** Index i is gameweek i + 1. */
  events: {
    deadline: number[];
    finished: (0 | 1)[];
  };
  teams: {
    id: number[];
    code: number[];
    name: string[];
    short: string[];
    /** [style, primary, secondary, gk] */
    kit: [KitStyle, string, string, string][];
  };
  players: {
    id: number[];
    code: number[];
    name: string[];
    team: number[];
    /** 1 GKP, 2 DEF, 3 MID, 4 FWD */
    pos: number[];
    price: number[];
    /** One FPL status char per player: a available, d doubtful, i injured, s suspended, u unavailable, n not in squad. */
    status: string;
    /** Chance of playing next round in %, -1 when FPL gives none. */
    chance: number[];
    news: string[];
    /** Form ×10. */
    form: number[];
    /** Selected-by % ×10. */
    sel: number[];
    pts: number[];
    /** One column per STAT_SCALES key, scaled to integers. A missing column decodes as 0. */
    stats?: Partial<Record<StatKey, number[]>>;
  };
  fixtures: {
    id: number[];
    /** 0 when not yet scheduled. */
    gw: number[];
    h: number[];
    a: number[];
    /** Difficulty for the home team (FPL FDR 1–5). */
    hd: number[];
    /** Difficulty for the away team. */
    ad: number[];
    /** Kickoff epoch seconds, 0 when unknown. */
    ko: number[];
    fin: (0 | 1)[];
    hs: number[];
    as: number[];
  };
  /** Expected points ×100, flat: values[playerIndex * gws + (gw - 1)], -1 when unknown. */
  xp: {
    gws: number;
    values: number[];
  };
}
