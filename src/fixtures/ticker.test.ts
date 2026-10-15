import { describe, expect, it } from "vitest";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT } from "@/data/format";
import { cellScore, lastTickerStart, sortRows, squadCounts, tickerRows } from "./ticker";

/**
 * Four clubs over three gameweeks (next is GW2):
 * GW2: ONE (h) v TWO, THR (h) v FOU
 * GW3: ONE (h) v THR, ONE v FOU (away): a double for ONE, a blank for TWO
 */
const data = decodeBootstrap({
  format: BOOTSTRAP_FORMAT,
  season: "2026-27",
  generatedAt: 0,
  currentGw: 1,
  nextGw: 2,
  events: { deadline: [1, 2, 3], finished: [1, 0, 0] },
  teams: {
    id: [1, 2, 3, 4],
    code: [1, 2, 3, 4],
    name: ["One", "Two", "Three", "Four"],
    short: ["ONE", "TWO", "THR", "FOU"],
    kit: [
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
    ],
  },
  players: {
    id: [10, 11, 12],
    code: [10, 11, 12],
    name: ["A", "B", "C"],
    team: [1, 1, 3],
    pos: [3, 3, 4],
    price: [50, 50, 50],
    status: "aaa",
    chance: [-1, -1, -1],
    news: ["", "", ""],
    form: [0, 0, 0],
    sel: [0, 0, 0],
    pts: [0, 0, 0],
  },
  fixtures: {
    id: [1, 2, 3, 4],
    gw: [2, 2, 3, 3],
    h: [1, 3, 1, 4],
    a: [2, 4, 3, 1],
    hd: [2, 3, 2, 3],
    ad: [4, 3, 3, 4],
    ko: [0, 0, 0, 0],
    fin: [0, 0, 0, 0],
    hs: [-1, -1, -1, -1],
    as: [-1, -1, -1, -1],
  },
  xp: { gws: 0, values: [] },
});

describe("tickerRows", () => {
  const rows = tickerRows(data, 2, 5);
  const row = (short: string) => rows.find((r) => r.team.short === short)!;

  it("stops at the last gameweek of the season", () => {
    expect(row("ONE").cells.map((c) => c.gw)).toEqual([2, 3]);
  });

  it("gives each team its own side of the fixture", () => {
    expect(row("ONE").cells[0].fixtures).toEqual([{ opponent: 2, home: true, difficulty: 2 }]);
    expect(row("TWO").cells[0].fixtures).toEqual([{ opponent: 1, home: false, difficulty: 4 }]);
  });

  it("marks doubles with two fixtures and blanks with none", () => {
    expect(row("ONE").cells[1].fixtures).toHaveLength(2);
    expect(row("TWO").cells[1].fixtures).toEqual([]);
  });

  it("scores a blank as the hardest and a double as its easier fixture less a bonus", () => {
    expect(cellScore(row("TWO").cells[1])).toBe(5);
    expect(cellScore(row("ONE").cells[1])).toBe(1); // easier of 2 and 4, less 1
    expect(row("ONE").score).toBe(1.5);
    expect(row("TWO").score).toBe(4.5);
  });
});

describe("sortRows", () => {
  it("puts the easiest run first, ties by name, or sorts A–Z", () => {
    const rows = tickerRows(data, 2, 5);
    expect(sortRows(rows, "easy").map((r) => r.team.short)).toEqual(["ONE", "FOU", "THR", "TWO"]);
    expect(sortRows(rows, "name").map((r) => r.team.short)).toEqual(["FOU", "ONE", "THR", "TWO"]);
  });
});

describe("lastTickerStart", () => {
  it("keeps the range full, but never starts before the next gameweek", () => {
    expect(lastTickerStart(data, 5)).toBe(2);
  });
});

describe("squadCounts", () => {
  it("counts players per club, skipping empty slots", () => {
    expect(squadCounts(data, [10, 11, 12, -10])).toEqual(
      new Map([
        [1, 2],
        [3, 1],
      ]),
    );
  });
});
