import type { ChipName } from "@/config/rules";

/** Raw FPL API shapes: only the fields we read. */

export interface FplBootstrapSlim {
  events: { id: number; is_current: boolean; is_next: boolean; finished: boolean }[];
  elements: { id: number; now_cost: number; cost_change_start: number }[];
}

export interface FplEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  started_event: number;
  current_event: number | null;
}

export interface FplHistory {
  current: {
    event: number;
    points: number;
    total_points: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  }[];
  chips: { name: string; event: number }[];
}

export interface FplTransfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  event: number;
  time: string;
}

export interface FplPicks {
  active_chip: string | null;
  entry_history: { event: number; bank: number; points: number };
  picks: { element: number; position: number; is_captain: boolean; is_vice_captain: boolean }[];
}

/** What /api/team/{entryId} returns: everything needed to start planning. */
export interface TeamImport {
  entryId: number;
  teamName: string;
  managerName: string;
  /** Epoch ms. */
  importedAt: number;
  /** First gameweek the entry played. */
  startedGw: number;
  /** The last gameweek whose deadline has passed. */
  currentGw: number;
  /** First gameweek to plan (the next deadline). */
  planFromGw: number;
  /** 15 player ids: 0–10 starters, 11–14 bench in order (11 = bench GK). */
  slots: number[];
  captain: number;
  vice: number;
  /** Tenths of £1m. */
  bank: number;
  freeTransfers: number;
  /** Purchase and derived selling price per squad player, tenths of £1m. */
  prices: Record<number, { purchase: number; selling: number }>;
  chipsUsed: { name: ChipName; gw: number }[];
  /** Per finished/current gameweek, for the read-only past view. */
  history: { gw: number; points: number; transfers: number; cost: number; bank: number }[];
}

/** What /api/team/{entryId}/picks/{gw} returns for the read-only past view. */
export interface PastPicks {
  gw: number;
  slots: number[];
  captain: number;
  vice: number;
  chip: ChipName | null;
  points: number;
  /** Points each picked player scored, per fixture (two in a double, none in a blank). */
  playerPoints: Record<number, FixturePoints[]>;
}

export interface FixturePoints {
  fixture: number;
  points: number;
}

/** /event/{gw}/live/, trimmed to what the past view needs. */
export interface FplLive {
  elements: { id: number; explain: { fixture: number; stats: { points: number }[] }[] }[];
}
