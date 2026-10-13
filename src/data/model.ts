import type { Kit } from "@/config/kits";
import type { Position } from "@/config/rules";

export type PlayerStatus = "a" | "d" | "i" | "s" | "u" | "n";

export interface Team {
  id: number;
  code: number;
  name: string;
  short: string;
  kit: Kit;
}

export interface Player {
  id: number;
  /** Stable cross-season id, used for photos. */
  code: number;
  name: string;
  team: number;
  pos: Position;
  /** Tenths of £1m. */
  price: number;
  status: PlayerStatus;
  chance: number | null;
  news: string;
  form: number;
  selectedBy: number;
  totalPoints: number;
  /** Row in the expected-points table. */
  index: number;
}

export interface Fixture {
  id: number;
  gw: number | null;
  home: number;
  away: number;
  homeDifficulty: number;
  awayDifficulty: number;
  /** Epoch ms. */
  kickoff: number | null;
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

export interface GameEvent {
  gw: number;
  /** Epoch ms. */
  deadline: number;
  finished: boolean;
}

export interface GameData {
  season: string;
  generatedAt: number;
  currentGw: number | null;
  nextGw: number | null;
  events: GameEvent[];
  teams: Team[];
  teamById: Map<number, Team>;
  players: Player[];
  playerById: Map<number, Player>;
  fixtures: Fixture[];
  /** Index gw holds that gameweek's fixtures; index 0 holds unscheduled ones. */
  fixturesByGw: Fixture[][];
  /** Key: teamId * 100 + gw. Missing key means a blank gameweek. */
  teamGwFixtures: Map<number, Fixture[]>;
  xpGws: number;
  /** Expected points ×100, -1 when unknown. See xpFor(). */
  xp: Int16Array;
}

/** A team's fixtures in a gameweek: [] for a blank, two entries for a double. */
export function fixturesFor(data: GameData, teamId: number, gw: number): Fixture[] {
  return data.teamGwFixtures.get(teamId * 100 + gw) ?? [];
}

export function xpFor(data: GameData, player: Player, gw: number): number | null {
  if (gw < 1 || gw > data.xpGws) return null;
  const v = data.xp[player.index * data.xpGws + gw - 1];
  return v < 0 ? null : v / 100;
}
