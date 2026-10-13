import type { Position, SeasonRules } from "@/config/rules";
import { BENCH_GK_SLOT, STARTERS, type Slots } from "./types";

export const POSITION_ORDER: Position[] = ["GKP", "DEF", "MID", "FWD"];

export function isStarter(slots: Slots, id: number): boolean {
  const i = slots.indexOf(id);
  return i >= 0 && i < STARTERS;
}

/** True when the starting XI meets the formation rules (1 GK, 3+ DEF, 2+ MID, 1+ FWD…). */
export function isValidLineup(slots: Slots, position: (id: number) => Position, rules: SeasonRules): boolean {
  const counts: Record<Position, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (let i = 0; i < STARTERS; i++) counts[position(slots[i])]++;
  return POSITION_ORDER.every((p) => {
    const r = rules.squad.positions[p];
    return counts[p] >= r.minPlay && counts[p] <= r.maxPlay;
  });
}

/**
 * Whether two squad players can swap places in sub mode:
 * - two starters: not offered (it changes nothing);
 * - two bench outfield players: reorders bench priority;
 * - goalkeepers only swap with goalkeepers;
 * - starter ↔ bench: allowed if the resulting XI is a valid formation.
 */
export function canSwap(
  slots: Slots,
  a: number,
  b: number,
  position: (id: number) => Position,
  rules: SeasonRules,
): boolean {
  const ia = slots.indexOf(a);
  const ib = slots.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return false;
  const aStarts = ia < STARTERS;
  const bStarts = ib < STARTERS;
  if (aStarts && bStarts) return false;

  const aGk = position(a) === "GKP";
  const bGk = position(b) === "GKP";
  if (aGk !== bGk) return false;
  if (!aStarts && !bStarts) return ia !== BENCH_GK_SLOT && ib !== BENCH_GK_SLOT;
  if (aGk) return true;

  return isValidLineup(swapSlots(slots, ia, ib), position, rules);
}

export function swapSlots(slots: Slots, i: number, j: number): Slots {
  const next = slots.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The starting XI grouped into pitch rows (GK, DEF, MID, FWD), keeping slot order within a row. */
export function formationRows(slots: Slots, position: (id: number) => Position): number[][] {
  const rows: number[][] = [[], [], [], []];
  for (let i = 0; i < STARTERS; i++) rows[POSITION_ORDER.indexOf(position(slots[i]))].push(slots[i]);
  return rows;
}

/** Players per club across the 15-man squad. */
export function clubCounts(slots: Slots, team: (id: number) => number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of slots) counts.set(team(id), (counts.get(team(id)) ?? 0) + 1);
  return counts;
}
