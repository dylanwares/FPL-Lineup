import { describe, expect, it } from "vitest";
import { KITS } from "@/config/kits";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "@/data/format";
import { decodeBootstrap } from "@/data/decode";
import type { GwState } from "@/engine/types";
import { budgetFor, candidatesFor, DEFAULT_FILTERS } from "./candidates";

/**
 * A tiny league: 3 teams, a squad of 15 (ids 1–15) and outside midfielders
 * 20–24. Squad has two midfielders (8, 9) from team 1.
 */
const K = KITS[3];
function data() {
  type P = [id: number, name: string, team: number, pos: number, price: number];
  const players: P[] = [
    [1, "Gk A", 2, 1, 45],
    [2, "Gk B", 3, 1, 40],
    [3, "Def A", 2, 2, 50],
    [4, "Def B", 2, 2, 50],
    [5, "Def C", 3, 2, 45],
    [6, "Def D", 3, 2, 45],
    [7, "Def E", 3, 2, 40],
    [8, "Mid A", 1, 3, 80],
    [9, "Mid B", 1, 3, 70],
    [10, "Mid C", 2, 3, 60],
    [11, "Mid D", 3, 3, 55],
    [12, "Mid E", 3, 3, 50],
    [13, "Fwd A", 2, 4, 90],
    [14, "Fwd B", 3, 4, 60],
    [15, "Fwd C", 3, 4, 45],
    [20, "Ødegaard", 1, 3, 85],
    [21, "João Mid", 1, 3, 60],
    [22, "Cheap Mid", 2, 3, 45],
    [23, "Pricey Mid", 3, 3, 130],
    [24, "No Xp Mid", 2, 3, 50],
  ];
  const n = players.length;
  const file: BootstrapFile = {
    format: BOOTSTRAP_FORMAT,
    season: "2026-27",
    generatedAt: 0,
    currentGw: 6,
    nextGw: 7,
    events: { deadline: Array(38).fill(0), finished: Array(38).fill(0) },
    teams: {
      id: [1, 2, 3],
      code: [3, 14, 43],
      name: ["Alpha", "Beta", "Gamma"],
      short: ["ALP", "BET", "GAM"],
      kit: Array(3).fill(["plain", K.primary, K.secondary, K.gk]),
    },
    players: {
      id: players.map((p) => p[0]),
      code: players.map((p) => p[0]),
      name: players.map((p) => p[1]),
      team: players.map((p) => p[2]),
      pos: players.map((p) => p[3]),
      price: players.map((p) => p[4]),
      status: "a".repeat(n),
      chance: Array(n).fill(-1),
      news: Array(n).fill(""),
      form: players.map((p) => p[0]),
      sel: Array(n).fill(0),
      pts: Array(n).fill(0),
    },
    fixtures: { id: [], gw: [], h: [], a: [], hd: [], ad: [], ko: [], fin: [], hs: [], as: [] },
    // xP in GW7 = price / 10, except player 24 (unknown).
    xp: {
      gws: 38,
      values: players.flatMap((p) =>
        Array.from({ length: 38 }, (_, g) => (g === 6 && p[0] !== 24 ? p[4] * 10 : -1)),
      ),
    },
  };
  return decodeBootstrap(file);
}

const D = data();
const state = {
  gw: 7,
  slots: [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 2, 7, 12, 15],
  bank: 5,
  purchase: { 10: 60 },
} as unknown as GwState;

const ids = (filters = {}) =>
  candidatesFor(D, state, 10, 7, { ...DEFAULT_FILTERS, ...filters }, 3).map((c) => c.player.id);

describe("candidatesFor", () => {
  it("lists same-position players outside the squad, best projected first, unknowns last", () => {
    expect(ids()).toEqual([23, 20, 21, 22, 24]);
  });

  it("sorts by other metrics", () => {
    expect(ids({ sort: "price" })).toEqual([23, 20, 21, 24, 22]);
  });

  it("filters by search (accent-insensitive), team and max price", () => {
    expect(ids({ query: "odeg" })).toEqual([20]);
    expect(ids({ query: "joao" })).toEqual([21]);
    expect(ids({ team: 2 })).toEqual([22, 24]);
    expect(ids({ maxPrice: 50 })).toEqual([22, 24]);
  });

  it("works out the budget as bank plus selling price", () => {
    expect(budgetFor(D, state, 10)).toBe(65);
    expect(ids({ affordable: true })).toEqual([21, 22, 24]);
  });

  it("keeps unaffordable and fourth-from-club players, with reasons", () => {
    const reasons = (st: GwState) =>
      new Map(candidatesFor(D, st, 10, 7, DEFAULT_FILTERS, 3).map((r) => [r.player.id, r.reasons]));

    // Team 1 has two squad players (8, 9): a third is fine.
    expect(reasons(state).get(21)).toEqual([]);
    // Too expensive (and Gamma is already full in this squad).
    expect(reasons(state).get(23)).toEqual(["£6.5m over budget", "4th from GAM"]);

    // Swap Mid D (Gamma) for Ødegaard (Alpha): Alpha now has three, so another is a fourth.
    const fullAlpha = { ...state, slots: state.slots.map((id) => (id === 11 ? 20 : id)) } as GwState;
    expect(reasons(fullAlpha).get(21)).toEqual(["4th from ALP"]);
  });
});
