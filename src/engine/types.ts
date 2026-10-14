import type { ChipName, Position, SeasonRules } from "@/config/rules";

/** Squad slots: indices 0–10 are the starting XI, 11–14 the bench in priority order (11 = bench GK). */
export type Slots = number[];

export const STARTERS = 11;
export const BENCH_GK_SLOT = 11;

export interface ChipUse {
  name: ChipName;
  gw: number;
}

/** The squad as it stands going into the first planned gameweek. */
export interface Snapshot {
  /** First gameweek the plan covers (the next deadline). */
  gw: number;
  slots: Slots;
  captain: number;
  vice: number;
  /** Tenths of £1m. */
  bank: number;
  freeTransfers: number;
  /** Purchase price per owned player id, tenths of £1m. */
  purchase: Record<number, number>;
  chipsUsed: ChipUse[];
}

export type Move =
  | { type: "transfer"; gw: number; out: number; in: number }
  | { type: "sub"; gw: number; a: number; b: number }
  | { type: "captain"; gw: number; player: number }
  | { type: "vice"; gw: number; player: number }
  | { type: "chip"; gw: number; chip: ChipName | null };

export interface Plan {
  id: string;
  entryId: number;
  name: string;
  base: Snapshot;
  moves: Move[];
  createdAt: number;
  updatedAt: number;
}

export type Warning =
  | { kind: "over-budget"; amount: number }
  | { kind: "club-limit"; team: number; count: number }
  | { kind: "transfer-limit"; count: number; max: number }
  | { kind: "invalid-move"; move: Move; reason: string };

/** The computed state of one planned gameweek. */
export interface GwState {
  gw: number;
  slots: Slots;
  captain: number;
  vice: number;
  purchase: Record<number, number>;
  /** Bank after this gameweek's transfers (may be negative while planning). */
  bank: number;
  /** Free transfers available going into this gameweek. */
  freeTransfers: number;
  /** Net transfers made this gameweek (chains and buybacks collapse). */
  transfers: number;
  /** Points deducted for transfers beyond the free ones. */
  cost: number;
  chip: ChipName | null;
  /** Chips used up to and including this gameweek. */
  chipsUsed: ChipUse[];
  sold: number[];
  bought: number[];
  warnings: Warning[];
}

/** What the engine needs to know about players; built once from the game data. */
export interface EngineContext {
  rules: SeasonRules;
  position(id: number): Position;
  team(id: number): number;
  /** Current price in tenths of £1m (future price changes are not modelled). */
  price(id: number): number;
}
