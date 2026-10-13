import type { KitStyle } from "@/config/kits";

/**
 * The on-the-wire bootstrap file. Columnar (one array per field) so it gzips
 * well and decodes in a single pass. Bump BOOTSTRAP_FORMAT on breaking changes;
 * clients discard cached files with a different format.
 *
 * Conventions: money in tenths of £1m, epoch times in seconds, -1 for "none".
 */
export const BOOTSTRAP_FORMAT = 1;

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
