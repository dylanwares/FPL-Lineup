import type { Position, SeasonRules } from "@/config/rules";
import { fixturesFor, xpFor, type GameData } from "@/data/model";
import type { GwState } from "@/engine/types";
import { STARTERS } from "@/engine/types";

export interface GwProjection {
  /** Points from the players who count, with the armband, before hits. */
  total: number;
  /** After transfer hits. */
  net: number;
  hit: number;
  /** Who gets the armband multiplier (the vice if the captain won't play), or null. */
  captain: number | null;
  multiplier: number;
  /** Bench players auto-subbed in for starters who won't play, in bench order. */
  autoSubs: { out: number; in: number }[];
  /** Bench Boost: what the bench adds. */
  benchBoost: number | null;
  /** No projections at all for this gameweek yet. */
  unknown: boolean;
}

/**
 * Projected points for one planned gameweek, scored as FPL would with the
 * projections standing in for minutes: a player "plays" if their club has a
 * fixture and they're projected more than 0. Starters who won't play are
 * auto-subbed by the first bench player (in priority order) who will and who
 * keeps a legal formation; the goalkeeper only by the bench goalkeeper. If
 * the captain won't play the vice takes the armband. Bench Boost counts all
 * fifteen and makes no subs.
 */
export function projectGw(data: GameData, state: GwState, rules: SeasonRules): GwProjection {
  const { gw, slots } = state;
  const player = (id: number) => data.playerById.get(id);
  const xp = (id: number) => {
    const p = player(id);
    return p ? (xpFor(data, p, gw) ?? 0) : 0;
  };
  const plays = (id: number) => {
    const p = player(id);
    return !!p && fixturesFor(data, p.team, gw).length > 0 && xp(id) > 0;
  };
  // An empty slot (negative id) keeps the removed player's position, and never plays.
  const position = (id: number): Position => player(Math.abs(id))?.pos ?? "MID";
  /** What a player scores: nothing without a fixture, whatever the projection says. */
  const points = (id: number) => (plays(id) ? xp(id) : 0);

  const unknown = slots.every((id) => {
    const p = player(id);
    return !p || xpFor(data, p, gw) == null;
  });

  const benchBoosted = state.chip === "bboost";
  const xi = slots.slice(0, STARTERS);
  const bench = slots.slice(STARTERS);
  const autoSubs: GwProjection["autoSubs"] = [];

  if (!benchBoosted) {
    const used = new Set<number>();
    for (let i = 0; i < xi.length; i++) {
      const out = xi[i];
      if (plays(out)) continue;
      const isGk = position(out) === "GKP";
      const sub = bench.find((id) => {
        if (used.has(id) || !plays(id) || (position(id) === "GKP") !== isGk) return false;
        const next = xi.map((x, j) => (j === i ? id : x));
        return isGk || validFormation(next, position, rules);
      });
      if (sub === undefined) continue;
      used.add(sub);
      xi[i] = sub;
      autoSubs.push({ out, in: sub });
    }
  }

  const counted = benchBoosted ? slots : xi;
  const base = counted.reduce((sum, id) => sum + points(id), 0);
  const captain = plays(state.captain) ? state.captain : plays(state.vice) ? state.vice : null;
  const multiplier = state.chip === "3xc" ? rules.captainMultiplier.triple : rules.captainMultiplier.normal;
  const total = base + (captain === null ? 0 : (multiplier - 1) * xp(captain));

  return {
    total,
    net: total - state.cost,
    hit: state.cost,
    captain,
    multiplier,
    autoSubs,
    benchBoost: benchBoosted ? bench.reduce((sum, id) => sum + points(id), 0) : null,
    unknown,
  };
}

/** Whether an XI keeps every position's minimum (3 DEF, 2 MID, 1 FWD). */
function validFormation(xi: number[], position: (id: number) => Position, rules: SeasonRules): boolean {
  const counts: Record<Position, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const id of xi) counts[position(id)]++;
  return (Object.keys(counts) as Position[]).every((p) => counts[p] >= rules.squad.positions[p].minPlay);
}
