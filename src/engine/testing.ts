import { getRules, type Position } from "@/config/rules";
import type { EngineContext, Plan, Snapshot } from "./types";

/**
 * Test fixtures: a 15-man squad (ids 1–15) plus a transfer pool (16–30).
 * Squad: GK 1, 2 · DEF 3–7 · MID 8–12 · FWD 13–15. XI = 1, 3,4,5,6, 8,9,10,11, 13,14 (4-4-2).
 */
const POS: Record<number, Position> = {};
const assign = (ids: number[], p: Position) => ids.forEach((id) => (POS[id] = p));
assign([1, 2, 16, 17], "GKP");
assign([3, 4, 5, 6, 7, 18, 19, 20], "DEF");
assign([8, 9, 10, 11, 12, 21, 22, 23, 24], "MID");
assign([13, 14, 15, 25, 26, 27], "FWD");

export const PRICES: Record<number, number> = {};
for (let id = 1; id <= 30; id++) PRICES[id] = 50 + id; // 5.1m … 8.0m

/** Clubs: each squad player at a different club except where tests set otherwise. */
export const TEAMS: Record<number, number> = {};
for (let id = 1; id <= 30; id++) TEAMS[id] = id;

export function testContext(
  overrides: { prices?: Record<number, number>; teams?: Record<number, number> } = {},
): EngineContext {
  const prices = { ...PRICES, ...overrides.prices };
  const teams = { ...TEAMS, ...overrides.teams };
  return {
    rules: getRules(),
    position: (id) => POS[id],
    team: (id) => teams[id],
    price: (id) => prices[id],
  };
}

export function testSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const slots = [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 2, 7, 12, 15];
  return {
    gw: 7,
    slots,
    captain: 13,
    vice: 8,
    bank: 10,
    freeTransfers: 1,
    purchase: Object.fromEntries(slots.map((id) => [id, PRICES[id]])),
    chipsUsed: [],
    ...overrides,
  };
}

export function testPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "p1",
    entryId: 1,
    name: "Main plan",
    base: testSnapshot(),
    moves: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}
