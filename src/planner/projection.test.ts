import { describe, expect, it } from "vitest";
import { getRules } from "@/config/rules";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT } from "@/data/format";
import type { GwState } from "@/engine/types";
import { projectGw } from "./projection";

/**
 * 15 players, ids 1–15: GK 1, 2 · DEF 3–7 · MID 8–12 · FWD 13–15. All play
 * for club 1 (one GW1 fixture) except id 4 (DEF) and 13 (FWD), at club 2,
 * which is blank. xP is the id / 2, so player 10 is projected 5.0.
 */
const POS = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
const ids = POS.map((_, i) => i + 1);
const data = decodeBootstrap({
  format: BOOTSTRAP_FORMAT,
  season: "2026-27",
  generatedAt: 0,
  currentGw: null,
  nextGw: 1,
  events: { deadline: [1], finished: [0] },
  teams: {
    id: [1, 2, 3],
    code: [1, 2, 3],
    name: ["One", "Two", "Three"],
    short: ["ONE", "TWO", "THR"],
    kit: [
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
    ],
  },
  players: {
    id: ids,
    code: ids,
    name: ids.map((i) => `P${i}`),
    team: ids.map((i) => (i === 4 || i === 13 ? 2 : 1)),
    pos: POS,
    price: ids.map(() => 50),
    status: "a".repeat(15),
    chance: ids.map(() => -1),
    news: ids.map(() => ""),
    form: ids.map(() => 0),
    sel: ids.map(() => 0),
    pts: ids.map(() => 0),
  },
  fixtures: { id: [1], gw: [1], h: [1], a: [3], hd: [2], ad: [2], ko: [0], fin: [0], hs: [0], as: [0] },
  xp: { gws: 1, values: ids.map((i) => i * 50) },
});
const rules = getRules();

/** XI 1, 3,5,6,7, 8,9,10,11, 14,15 (4-4-2, everyone plays); bench GK 2, then 12, 4, 13. */
function state(overrides: Partial<GwState> = {}): GwState {
  return {
    gw: 1,
    slots: [1, 3, 5, 6, 7, 8, 9, 10, 11, 14, 15, 2, 12, 4, 13],
    captain: 15,
    vice: 14,
    purchase: {},
    bank: 0,
    freeTransfers: 1,
    transfers: 0,
    cost: 0,
    chip: null,
    chipsUsed: [],
    sold: [],
    bought: [],
    soldFor: {},
    warnings: [],
    ...overrides,
  };
}

const xi = [1, 3, 5, 6, 7, 8, 9, 10, 11, 14, 15];
const sum = (list: number[]) => list.reduce((s, i) => s + i / 2, 0);

describe("projectGw", () => {
  it("adds up the XI with the captain doubled, then takes off the hit", () => {
    const p = projectGw(data, state({ cost: 4 }), rules);
    expect(p.total).toBeCloseTo(sum(xi) + 7.5);
    expect(p.net).toBeCloseTo(sum(xi) + 7.5 - 4);
    expect(p).toMatchObject({ captain: 15, multiplier: 2, autoSubs: [], benchBoost: null, unknown: false });
  });

  it("triples the captain with Triple Captain", () => {
    const p = projectGw(data, state({ chip: "3xc" }), rules);
    expect(p.total).toBeCloseTo(sum(xi) + 2 * 7.5);
    expect(p.multiplier).toBe(3);
  });

  it("counts the bench with Bench Boost, without auto-subs", () => {
    const p = projectGw(
      data,
      state({ chip: "bboost", slots: [1, 3, 4, 6, 7, 8, 9, 10, 11, 14, 15, 2, 12, 5, 13] }),
      rules,
    );
    expect(p.autoSubs).toEqual([]);
    // Blank players (4, 13) score nothing either way.
    expect(p.benchBoost).toBeCloseTo(1 + 6 + 2.5);
  });

  it("auto-subs a blank starter with the first bench player who keeps the formation", () => {
    // DEF 4 starts in a 3-5-2 and is blank: the first bench outfielder (MID 12) can't come in
    // as it would leave 2 DEF, so DEF 5 does.
    const slots = [1, 3, 4, 6, 8, 9, 10, 11, 12, 14, 15, 2, 7, 5, 13];
    const fixed = [1, 3, 4, 6, 8, 9, 10, 11, 12, 14, 15];
    const p = projectGw(data, state({ slots }), rules);
    expect(p.autoSubs).toEqual([{ out: 4, in: 7 }]);
    expect(p.total).toBeCloseTo(sum(fixed) - 2 + 3.5 + 7.5);

    // With MID 12 first on the bench and a DEF to spare, MID 12 comes in.
    const four = projectGw(
      data,
      state({ slots: [1, 3, 4, 5, 6, 8, 9, 10, 11, 14, 15, 2, 12, 7, 13] }),
      rules,
    );
    expect(four.autoSubs).toEqual([{ out: 4, in: 12 }]);
  });

  it("passes the armband to the vice when the captain won't play", () => {
    const slots = [1, 3, 5, 6, 7, 8, 9, 10, 11, 13, 15, 2, 12, 4, 14];
    const p = projectGw(data, state({ slots, captain: 13, vice: 15 }), rules);
    expect(p.captain).toBe(15);
    // FWD 13 is blank; MID 12, first on the bench, comes in as FWD 15 still makes the minimum of one.
    expect(p.autoSubs).toEqual([{ out: 13, in: 12 }]);
  });

  it("only swaps a goalkeeper for the bench goalkeeper", () => {
    const blankGk = { ...data, playerById: new Map(data.playerById) };
    blankGk.playerById.set(1, { ...data.playerById.get(1)!, team: 2 });
    const p = projectGw(blankGk, state(), rules);
    expect(p.autoSubs).toEqual([{ out: 1, in: 2 }]);
  });
});
