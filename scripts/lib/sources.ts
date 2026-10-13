import type { ChipName } from "../../src/config/rules";

/**
 * Normalised game data every source produces. The FPL API source is used for
 * now; a source backed by the tracker's Postgres can replace it later without
 * touching the transform.
 */
export interface SourceData {
  events: { gw: number; deadline: number; finished: boolean; isCurrent: boolean; isNext: boolean }[];
  teams: { id: number; code: number; name: string; short: string }[];
  players: {
    id: number;
    code: number;
    name: string;
    team: number;
    pos: 1 | 2 | 3 | 4;
    price: number;
    status: string;
    chance: number | null;
    news: string;
    form: number;
    selectedBy: number;
    totalPoints: number;
    /** FPL's own next-gameweek estimate, the fallback when projections are missing. */
    epNext: number | null;
  }[];
  fixtures: {
    id: number;
    gw: number | null;
    home: number;
    away: number;
    homeDifficulty: number;
    awayDifficulty: number;
    kickoff: number | null;
    finished: boolean;
    homeScore: number | null;
    awayScore: number | null;
  }[];
  /** Chip windows as the source reports them, checked against the rules config. */
  chips: { name: ChipName; start: number; stop: number }[];
}

export interface DataSource {
  name: string;
  load(): Promise<SourceData>;
}

/** Expected points per FPL player id; index i is gameweek i + 1. */
export type Projections = Map<number, (number | null)[]>;

export interface ProjectionSource {
  name: string;
  load(): Promise<Projections>;
}
