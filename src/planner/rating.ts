import type { Position, SeasonRules } from "@/config/rules";
import { xpFor, type GameData } from "@/data/model";
import type { GwState } from "@/engine/types";
import { STARTERS } from "@/engine/types";

/*
 * The team rating: your starting XI's expected points as a share of the best
 * XI any legal £100.0m squad could field that gameweek. Both sides are raw
 * sums of expected points: no armband, chips, hits or auto-subs.
 */

export interface PerfectTeam {
  /** The XI's expected points. */
  total: number;
  xi: number[];
  /** The cheapest bench that completes a legal squad. */
  bench: number[];
  /** Tenths of £1m, XI and bench. */
  cost: number;
}

export interface TeamRating {
  mine: number;
  best: number;
  /** Whole percent, capped at 100 (a squad can be worth more than the budget). */
  pct: number;
  perfect: PerfectTeam;
}

const POSITIONS: readonly Position[] = ["GKP", "DEF", "MID", "FWD"];

interface Candidate {
  id: number;
  club: number;
  price: number;
  xp: number;
}

type Counts = Record<Position, number>;

const memo = new WeakMap<GameData, Map<string, PerfectTeam | null>>();

/** The best XI a legal squad within the budget can field in `gw`, or null with no projections. */
export function perfectTeam(data: GameData, gw: number, rules: SeasonRules): PerfectTeam | null {
  let byGw = memo.get(data);
  if (!byGw) memo.set(data, (byGw = new Map()));
  const key = `${rules.season}:${gw}`;
  if (!byGw.has(key)) byGw.set(key, solve(data, gw, rules));
  return byGw.get(key)!;
}

/** Your XI against the perfect team, or null when there's nothing to compare with. */
export function teamRating(data: GameData, state: GwState, rules: SeasonRules): TeamRating | null {
  const perfect = perfectTeam(data, state.gw, rules);
  if (!perfect || perfect.total <= 0) return null;
  const mine = state.slots.slice(0, STARTERS).reduce((sum, id) => {
    const p = data.playerById.get(id);
    return sum + (p ? (xpFor(data, p, state.gw) ?? 0) : 0);
  }, 0);
  return { mine, best: perfect.total, pct: Math.min(100, Math.round((mine / perfect.total) * 100)), perfect };
}

function solve(data: GameData, gw: number, rules: SeasonRules): PerfectTeam | null {
  const { squad } = rules;
  const all: Record<Position, Candidate[]> = { GKP: [], DEF: [], MID: [], FWD: [] };
  let known = false;
  for (const p of data.players) {
    const xp = xpFor(data, p, gw);
    if (xp != null) known = true;
    all[p.pos].push({ id: p.id, club: p.team, price: p.price, xp: xp ?? 0 });
  }
  if (!known) return null;

  // Whoever else is in the squad can fill at most this many clubs besides a player's own.
  const fullClubs = Math.floor((squad.size - 1) / squad.maxPerClub);
  const starters = {} as Record<Position, Candidate[]>;
  const bench = {} as Record<Position, Candidate[]>;
  for (const pos of POSITIONS) {
    const count = squad.positions[pos].squad;
    // Starters: best first, kept unless enough players score as much for no more.
    starters[pos] = prune(
      [...all[pos]].sort((a, b) => b.xp - a.xp || a.price - b.price),
      count,
      fullClubs,
    );
    // Bench: cheapest first, kept unless enough players cost no more.
    bench[pos] = prune(
      [...all[pos]].sort((a, b) => a.price - b.price || a.xp - b.xp),
      count,
      fullClubs,
    );
  }

  let best: Pick | null = null;
  for (const shape of formations(rules)) {
    const benchShape = Object.fromEntries(
      POSITIONS.map((pos) => [pos, squad.positions[pos].squad - shape[pos]]),
    ) as Counts;
    best = search(starters, bench, shape, benchShape, squad.budget, squad.maxPerClub, best);
  }
  return (
    best && {
      total: best.total,
      xi: best.xi.map((c) => c.id),
      bench: best.bench.map((c) => c.id),
      cost: best.cost,
    }
  );
}

/** Every legal XI shape: 1 GK and 10 outfielders within each position's limits. */
function formations(rules: SeasonRules): Counts[] {
  const { positions, starters } = rules.squad;
  const shapes: Counts[] = [];
  const range = (pos: Position) => {
    const out: number[] = [];
    for (let n = positions[pos].minPlay; n <= positions[pos].maxPlay; n++) out.push(n);
    return out;
  };
  for (const GKP of range("GKP"))
    for (const DEF of range("DEF"))
      for (const MID of range("MID"))
        for (const FWD of range("FWD"))
          if (GKP + DEF + MID + FWD === starters) shapes.push({ GKP, DEF, MID, FWD });
  return shapes;
}

/**
 * Drops players who are never needed. `sorted` is best first by the measure
 * that matters (xP to start, price to sit on the bench), and a player counts
 * as beaten by everyone before them who costs no more. If enough of those are
 * free to swap in, one always is: the squad holds at most `need - 1` others at
 * the position (`need` is the position's squad count), and the rest of the squad can fill at most `fullClubs` clubs
 * besides the player's own (their own club stays open, they leave it).
 */
function prune(sorted: Candidate[], need: number, fullClubs: number): Candidate[] {
  return sorted.filter((p, i) => {
    const perClub = new Map<number, number>();
    let own = 0;
    for (let j = 0; j < i; j++) {
      const q = sorted[j];
      if (q.price > p.price) continue;
      if (q.club === p.club) own++;
      else perClub.set(q.club, (perClub.get(q.club) ?? 0) + 1);
    }
    const others = [...perClub.values()].sort((a, b) => b - a);
    return own + others.slice(fullClubs).reduce((s, n) => s + n, 0) < need;
  });
}

interface Pick {
  total: number;
  cost: number;
  xi: Candidate[];
  bench: Candidate[];
}

/**
 * The best squad whose XI has `shape`, by branch and bound, or `best` if
 * nothing beats it. The XI is picked best-first, so the first squads found
 * are strong and most of the tree is cut by the xP bound; the bench (which
 * scores nothing) only needs to fit what's left of the budget.
 */
function search(
  starters: Record<Position, Candidate[]>,
  benchPools: Record<Position, Candidate[]>,
  shape: Counts,
  benchShape: Counts,
  budget: number,
  maxPerClub: number,
  best: Pick | null,
): Pick | null {
  const order = POSITIONS.filter((pos) => shape[pos] > 0);
  if (order.some((pos) => starters[pos].length < shape[pos])) return best;
  const sum = (list: number[], from: number, count: number) => {
    let s = 0;
    for (let i = from; i < from + count && i < list.length; i++) s += list[i];
    return s;
  };
  const xps = order.map((pos) => starters[pos].map((c) => c.xp));
  const cheapest = (pool: Candidate[], count: number) =>
    sum(
      pool.map((c) => c.price).sort((a, b) => a - b),
      0,
      count,
    );
  // The cheapest any bench can be, and for each XI position the most later
  // positions can add and the least they can cost.
  const benchMin = POSITIONS.reduce((s, pos) => s + cheapest(benchPools[pos], benchShape[pos]), 0);
  const laterXp = order.map((_, k) =>
    order.slice(k + 1).reduce((s, pos, j) => s + sum(xps[k + 1 + j], 0, shape[pos]), 0),
  );
  const laterCost = order.map(
    (_, k) => benchMin + order.slice(k + 1).reduce((s, pos) => s + cheapest(starters[pos], shape[pos]), 0),
  );

  const clubs = new Map<number, number>();
  const used = new Set<number>();
  const xi: Candidate[] = [];
  const take = (c: Candidate) => {
    clubs.set(c.club, (clubs.get(c.club) ?? 0) + 1);
    used.add(c.id);
  };
  const drop = (c: Candidate) => {
    clubs.set(c.club, clubs.get(c.club)! - 1);
    used.delete(c.id);
  };
  const fits = (c: Candidate) => !used.has(c.id) && (clubs.get(c.club) ?? 0) < maxPerClub;

  /** A bench that fits in `left`, cheapest first, or null. */
  function fillBench(left: number): Candidate[] | null {
    const picks: Candidate[] = [];
    const positions = POSITIONS.filter((pos) => benchShape[pos] > 0);
    const minAfter = positions.map((_, k) =>
      positions.slice(k + 1).reduce((s, pos) => s + cheapest(benchPools[pos], benchShape[pos]), 0),
    );
    function go(k: number, from: number, need: number, spent: number): boolean {
      if (k === positions.length) return true;
      if (need === 0) return go(k + 1, 0, benchShape[positions[k + 1]] ?? 0, spent);
      const pool = benchPools[positions[k]];
      for (let i = from; i < pool.length; i++) {
        const c = pool[i];
        // Sorted by price: once one is too dear, the rest are too.
        if (spent + c.price + minAfter[k] > left) return false;
        if (!fits(c)) continue;
        take(c);
        picks.push(c);
        if (go(k, i + 1, need - 1, spent + c.price)) return true;
        picks.pop();
        drop(c);
      }
      return false;
    }
    const ok = go(0, 0, benchShape[positions[0]] ?? 0, 0);
    for (const c of picks) drop(c);
    return ok ? picks : null;
  }

  function go(k: number, from: number, need: number, total: number, spent: number) {
    if (k === order.length) {
      if (best && total <= best.total + 1e-9) return;
      const bench = fillBench(budget - spent);
      if (bench) {
        best = { total, xi: [...xi], bench, cost: spent + bench.reduce((s, c) => s + c.price, 0) };
      }
      return;
    }
    if (need === 0) return go(k + 1, 0, shape[order[k + 1]] ?? 0, total, spent);
    const pool = starters[order[k]];
    for (let i = from; i <= pool.length - need; i++) {
      // Sorted best first: nothing from here on can beat the best found.
      if (best && total + sum(xps[k], i, need) + laterXp[k] <= best.total + 1e-9) return;
      const c = pool[i];
      if (spent + c.price + laterCost[k] > budget || !fits(c)) continue;
      take(c);
      xi.push(c);
      go(k, i + 1, need - 1, total + c.xp, spent + c.price);
      xi.pop();
      drop(c);
    }
  }
  go(0, 0, shape[order[0]], 0, 0);
  return best;
}
