import { describe, expect, it } from "vitest";
import { getRules } from "@/config/rules";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT } from "@/data/format";
import type { GameData } from "@/data/model";
import type { GwState } from "@/engine/types";
import { perfectTeam, teamRating } from "./rating";

const rules = getRules();
const CLUBS = 8;

interface Spec {
  pos: 1 | 2 | 3 | 4;
  club: number;
  price: number;
  /** Expected points ×100 in GW1; -1 for unknown. */
  xp: number;
}

function game(players: Spec[]): GameData {
  const ids = players.map((_, i) => i + 1);
  const clubs = Array.from({ length: CLUBS }, (_, i) => i + 1);
  return decodeBootstrap({
    format: BOOTSTRAP_FORMAT,
    season: "2026-27",
    generatedAt: 0,
    currentGw: null,
    nextGw: 1,
    events: { deadline: [1], finished: [0] },
    teams: {
      id: clubs,
      code: clubs,
      name: clubs.map((c) => `Club ${c}`),
      short: clubs.map((c) => `C${c}`),
      kit: clubs.map(() => ["plain", "#f00", "#fff", "#ff0"]),
    },
    players: {
      id: ids,
      code: ids,
      name: ids.map((i) => `P${i}`),
      team: players.map((p) => p.club),
      pos: players.map((p) => p.pos),
      price: players.map((p) => p.price),
      status: "a".repeat(players.length),
      chance: ids.map(() => -1),
      news: ids.map(() => ""),
      form: ids.map(() => 0),
      sel: ids.map(() => 0),
      pts: ids.map(() => 0),
    },
    fixtures: { id: [], gw: [], h: [], a: [], hd: [], ad: [], ko: [], fin: [], hs: [], as: [] },
    xp: { gws: 1, values: players.map((p) => p.xp) },
  });
}

/** A seeded random number generator (mulberry32), so failures repeat. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPool(seed: number, counts = { 1: 3, 2: 7, 3: 7, 4: 5 }): Spec[] {
  const rand = random(seed);
  const out: Spec[] = [];
  for (const [pos, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      const price = 40 + Math.floor(rand() * 90);
      // Dearer players tend to score more, with plenty of noise.
      const xp = Math.max(0, Math.round((price - 40) * 6 * rand() + rand() * 300));
      out.push({ pos: Number(pos) as Spec["pos"], club: 1 + Math.floor(rand() * CLUBS), price, xp });
    }
  }
  return out;
}

function choose<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of choose(items.slice(i + 1), k - 1)) out.push([items[i], ...rest]);
  }
  return out;
}

/** Every legal squad, and the best XI each can field. */
function bruteForce(players: Spec[]): number | null {
  const at = (pos: number) => players.map((p, i) => ({ ...p, id: i + 1 })).filter((p) => p.pos === pos);
  const xp = (p: Spec) => Math.max(0, p.xp) / 100;
  let best: number | null = null;
  for (const gk of choose(at(1), 2))
    for (const def of choose(at(2), 5))
      for (const mid of choose(at(3), 5))
        for (const fwd of choose(at(4), 3)) {
          const squad = [...gk, ...def, ...mid, ...fwd];
          if (squad.reduce((s, p) => s + p.price, 0) > rules.squad.budget) continue;
          const clubs = new Map<number, number>();
          for (const p of squad) clubs.set(p.club, (clubs.get(p.club) ?? 0) + 1);
          if ([...clubs.values()].some((n) => n > rules.squad.maxPerClub)) continue;
          const desc = (list: Spec[]) => list.map(xp).sort((a, b) => b - a);
          const [g, d, m, f] = [desc(gk), desc(def), desc(mid), desc(fwd)];
          // The minimum 1-3-2-1, then the best four of the other outfielders.
          const rest = [...d.slice(3), ...m.slice(2), ...f.slice(1)].sort((a, b) => b - a);
          const total =
            g[0] + d[0] + d[1] + d[2] + m[0] + m[1] + f[0] + rest.slice(0, 4).reduce((s, n) => s + n, 0);
          if (best === null || total > best) best = total;
        }
  return best;
}

function checkLegal(data: GameData, team: NonNullable<ReturnType<typeof perfectTeam>>) {
  const squad = [...team.xi, ...team.bench].map((id) => data.playerById.get(id)!);
  expect(new Set(squad.map((p) => p.id)).size).toBe(15);
  const count = (list: typeof squad, pos: string) => list.filter((p) => p.pos === pos).length;
  for (const [pos, limits] of Object.entries(rules.squad.positions)) {
    expect(count(squad, pos)).toBe(limits.squad);
    const xi = team.xi.map((id) => data.playerById.get(id)!);
    expect(count(xi, pos)).toBeGreaterThanOrEqual(limits.minPlay);
    expect(count(xi, pos)).toBeLessThanOrEqual(limits.maxPlay);
  }
  expect(team.cost).toBe(squad.reduce((s, p) => s + p.price, 0));
  expect(team.cost).toBeLessThanOrEqual(rules.squad.budget);
  const clubs = new Map<number, number>();
  for (const p of squad) clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1);
  expect(Math.max(...clubs.values())).toBeLessThanOrEqual(rules.squad.maxPerClub);
}

describe("perfectTeam", () => {
  it("finds the best legal squad's XI, the same as trying every squad", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const pool = randomPool(seed);
      const data = game(pool);
      const team = perfectTeam(data, 1, rules);
      const expected = bruteForce(pool);
      if (expected === null) {
        expect(team, `seed ${seed}`).toBeNull();
        continue;
      }
      expect(team, `seed ${seed}`).not.toBeNull();
      expect(team!.total, `seed ${seed}`).toBeCloseTo(expected, 6);
      checkLegal(data, team!);
    }
  });

  it("benches the cheapest players and spends the rest on the XI", () => {
    const pool: Spec[] = [
      // Two keepers: the good one starts, the cheap one sits.
      { pos: 1, club: 1, price: 55, xp: 500 },
      { pos: 1, club: 2, price: 40, xp: 100 },
      { pos: 1, club: 3, price: 45, xp: 50 },
    ];
    for (const pos of [2, 3, 4] as const) {
      for (let i = 0; i < 7; i++)
        pool.push({ pos, club: 1 + ((i + pos) % CLUBS), price: 45 + i * 5, xp: 200 + i * 100 });
    }
    const data = game(pool);
    const team = perfectTeam(data, 1, rules)!;
    checkLegal(data, team);
    expect(team.xi).toContain(1);
    expect(team.bench).toContain(2);
  });

  it("is null when the gameweek has no projections", () => {
    const pool = randomPool(3).map((p) => ({ ...p, xp: -1 }));
    expect(perfectTeam(game(pool), 1, rules)).toBeNull();
    expect(perfectTeam(game(randomPool(3)), 2, rules)).toBeNull();
  });
});

describe("teamRating", () => {
  const pool = randomPool(7, { 1: 6, 2: 14, 3: 14, 4: 10 });
  const data = game(pool);
  const state = (slots: number[]): GwState => ({
    gw: 1,
    slots,
    captain: slots[0],
    vice: slots[1],
    purchase: {},
    bank: 0,
    freeTransfers: 1,
    transfers: 0,
    cost: 0,
    chip: null,
    chipsUsed: [],
    sold: [],
    bought: [],
    warnings: [],
  });

  it("compares your XI's raw expected points with the perfect XI's", () => {
    const perfect = perfectTeam(data, 1, rules)!;
    const mine = [...perfect.xi.slice(0, 10), -1, ...perfect.bench];
    const rating = teamRating(data, state(mine), rules)!;
    const dropped = Math.max(0, pool[perfect.xi[10] - 1].xp) / 100;
    expect(rating.best).toBeCloseTo(perfect.total);
    expect(rating.mine).toBeCloseTo(perfect.total - dropped); // the empty slot counts 0
    expect(rating.pct).toBe(Math.round((rating.mine / rating.best) * 100));
  });

  it("caps at 100%", () => {
    // Every player at once can't be a legal squad, but it out-scores one.
    const everyone = pool.map((_, i) => i + 1);
    const best = [...everyone].sort((a, b) => pool[b - 1].xp - pool[a - 1].xp).slice(0, 11);
    const rating = teamRating(
      data,
      state([...best, ...everyone.filter((id) => !best.includes(id)).slice(0, 4)]),
      rules,
    )!;
    expect(rating.mine).toBeGreaterThanOrEqual(rating.best);
    expect(rating.pct).toBe(100);
  });
});
