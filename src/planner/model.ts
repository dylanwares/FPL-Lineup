import { getRules, type ChipName } from "@/config/rules";
import type { TokenMetric } from "@/components/pitch/PlayerToken";
import type { GameData, Player } from "@/data/model";
import { fixturesFor } from "@/data/model";
import { computePlan, type PlanResult } from "@/engine/plan";
import type { EngineContext, Plan, Snapshot } from "@/engine/types";
import type { TeamImport } from "@/lib/fpl/types";

/** Chips in the order the chips row shows them. */
export const CHIPS: ChipName[] = ["wildcard", "freehit", "3xc", "bboost"];

export const CHIP_NAMES: Record<ChipName, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

/** Tile labels, short enough for four tiles across a phone. */
export const CHIP_SHORT: Record<ChipName, string> = { ...CHIP_NAMES, "3xc": "Triple Cap" };

/* ---------------- Engine wiring ---------------- */

const contexts = new WeakMap<GameData, EngineContext>();

/** One engine context per game-data load, so plan results can be reused across renders. */
export function engineContext(data: GameData): EngineContext {
  let ctx = contexts.get(data);
  if (!ctx) {
    const p = (id: number) => data.playerById.get(id);
    ctx = {
      rules: getRules(data.season),
      position: (id) => p(Math.abs(id))?.pos ?? "MID",
      team: (id) => p(id)?.team ?? 0,
      price: (id) => p(id)?.price ?? 0,
    };
    contexts.set(data, ctx);
  }
  return ctx;
}

let lastResult: PlanResult | undefined;

/** Plan results, memoised: an edit in GW N recomputes N…38 only. */
export function planResult(plan: Plan, data: GameData): PlanResult {
  const ctx = engineContext(data);
  if (lastResult && lastResult.plan === plan && lastResult.ctx === ctx) return lastResult;
  lastResult = computePlan(plan, ctx, lastResult);
  return lastResult;
}

/* ---------------- Plans from imports ---------------- */

export function snapshotFromImport(team: TeamImport): Snapshot {
  return {
    gw: team.planFromGw,
    slots: team.slots,
    captain: team.captain,
    vice: team.vice,
    bank: team.bank,
    freeTransfers: team.freeTransfers,
    purchase: Object.fromEntries(Object.entries(team.prices).map(([id, p]) => [id, p.purchase])),
    chipsUsed: team.chipsUsed,
  };
}

export function newPlan(team: TeamImport, name = "Main plan", now = Date.now()): Plan {
  return {
    id: crypto.randomUUID(),
    entryId: team.entryId,
    name,
    base: snapshotFromImport(team),
    moves: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Moves a plan onto a fresh import (e.g. after a deadline passes): the new
 * squad becomes the base and moves for gameweeks now in the past are dropped.
 */
export function rebasePlan(plan: Plan, team: TeamImport): Plan {
  // Not an edit (every device re-fits for itself), so "last edited" stays as it was.
  return {
    ...plan,
    base: snapshotFromImport(team),
    moves: plan.moves.filter((m) => m.gw >= team.planFromGw),
  };
}

/** A copy of a plan (snapshot and moves) under a new id and name. */
export function copyPlan(plan: Plan, name: string, now = Date.now()): Plan {
  return { ...plan, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now };
}

export const MAX_PLAN_NAME = 40;

/** `base`, or `base 2`, `base 3`… — the first that no plan uses yet. */
export function uniquePlanName(plans: Plan[], base: string): string {
  const taken = new Set(plans.map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/* ---------------- Display helpers ---------------- */

/** Tenths of £1m → "£8.5m" (or "-£0.4m"). */
export function formatPrice(tenths: number): string {
  const sign = tenths < 0 ? "-" : "";
  return `${sign}£${(Math.abs(tenths) / 10).toFixed(1)}m`;
}

/**
 * Fixture pills for a player's team in a gameweek: "BOU (H)" at home, "ars (a)"
 * away; short names only in a double; none in a blank.
 */
export function fixtureMetrics(data: GameData, teamId: number, gw: number): TokenMetric[] {
  const fixtures = fixturesFor(data, teamId, gw);
  return fixtures.map((f) => {
    const home = f.home === teamId;
    const opp = data.teamById.get(home ? f.away : f.home);
    const short = opp ? (home ? opp.short : opp.short.toLowerCase()) : "?";
    return {
      label: fixtures.length > 1 ? short : `${short} (${home ? "H" : "a"})`,
      difficulty: home ? f.homeDifficulty : f.awayDifficulty,
    };
  });
}

/**
 * A team's next `count` matches from `gw` (that gameweek included), one pill
 * each: the opponent's short name, capitals at home and lower case away, with
 * the difficulty for the colour. A double counts as two matches and a blank
 * as none, so there can be fewer than `count` at the end of the season.
 */
export function upcomingFixtures(data: GameData, teamId: number, gw: number, count = 3): TokenMetric[] {
  const out: TokenMetric[] = [];
  for (let g = gw; g < data.fixturesByGw.length && out.length < count; g++) {
    for (const f of fixturesFor(data, teamId, g)) {
      if (out.length === count) break;
      const home = f.home === teamId;
      const opp = data.teamById.get(home ? f.away : f.home);
      const short = opp?.short ?? "?";
      out.push({
        label: home ? short : short.toLowerCase(),
        difficulty: home ? f.homeDifficulty : f.awayDifficulty,
      });
    }
  }
  return out;
}

export function playerFlag(player: Player): "doubt" | "injured" | undefined {
  if (player.status === "a") return undefined;
  return player.status === "d" ? "doubt" : "injured";
}

const deadlineFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Saturday 17 Oct, 11:00" in the user's time zone. */
export function formatDeadline(ms: number): string {
  return deadlineFormat.format(ms);
}

/** "4d 21h 47m", "3h 05m", "12m". */
export function formatCountdown(msLeft: number): string {
  const mins = Math.max(0, Math.floor(msLeft / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}
