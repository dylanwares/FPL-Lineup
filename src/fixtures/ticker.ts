import { fixturesFor, type GameData, type Team } from "@/data/model";
import { isEmptySlot } from "@/engine/types";

export const RANGES = [5, 8] as const;
export type Range = (typeof RANGES)[number];
export type TickerSort = "easy" | "name";

/** A blank gameweek scores as the hardest fixture: nobody from that team plays. */
export const BLANK_SCORE = 5;
/** A double scores as its easier fixture, this much easier again (two chances to score). */
export const DOUBLE_BONUS = 1;

export interface TickerFixture {
  opponent: number;
  home: boolean;
  /** FPL FDR for this team, 1 (easy) to 5 (hard). */
  difficulty: number;
}

export interface TickerCell {
  gw: number;
  /** [] for a blank, two entries for a double. */
  fixtures: TickerFixture[];
}

export interface TickerRow {
  team: Team;
  cells: TickerCell[];
  /** Average gameweek score over the range: lower is an easier run. */
  score: number;
}

/** How good a gameweek is for a team's players, on the FDR scale (can drop below 1 for a double). */
export function cellScore(cell: TickerCell): number {
  if (cell.fixtures.length === 0) return BLANK_SCORE;
  const easiest = Math.min(...cell.fixtures.map((f) => f.difficulty));
  return cell.fixtures.length > 1 ? easiest - DOUBLE_BONUS : easiest;
}

/** The first gameweek the ticker can show: the next one to be played (the last, once the season ends). */
export function firstTickerGw(data: GameData): number {
  return data.nextGw ?? data.currentGw ?? 1;
}

/** The latest start that still fills the range, never before the first. */
export function lastTickerStart(data: GameData, range: Range): number {
  return Math.max(firstTickerGw(data), data.events.length - range + 1);
}

/** Every team's fixtures for `range` gameweeks from `start`. */
export function tickerRows(data: GameData, start: number, range: Range): TickerRow[] {
  const end = Math.min(data.events.length, start + range - 1);
  return data.teams.map((team) => {
    const cells: TickerCell[] = [];
    for (let gw = start; gw <= end; gw++) {
      cells.push({
        gw,
        fixtures: fixturesFor(data, team.id, gw).map((f) => {
          const home = f.home === team.id;
          return {
            opponent: home ? f.away : f.home,
            home,
            difficulty: home ? f.homeDifficulty : f.awayDifficulty,
          };
        }),
      });
    }
    const score = cells.length ? cells.reduce((sum, c) => sum + cellScore(c), 0) / cells.length : 0;
    return { team, cells, score };
  });
}

/** Easiest run first (ties by name), or A–Z. */
export function sortRows(rows: TickerRow[], sort: TickerSort): TickerRow[] {
  const byName = (a: TickerRow, b: TickerRow) => a.team.name.localeCompare(b.team.name);
  return [...rows].sort(sort === "easy" ? (a, b) => a.score - b.score || byName(a, b) : byName);
}

/** How many of a squad's players each team has. Empty slots don't count. */
export function squadCounts(data: GameData, slots: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of slots) {
    if (isEmptySlot(id)) continue;
    const team = data.playerById.get(id)?.team;
    if (team !== undefined) counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}
