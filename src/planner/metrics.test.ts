import { describe, expect, it } from "vitest";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT } from "@/data/format";
import { metricPills, pastPills, rateTier, xpOver } from "./metrics";

/**
 * Two teams over 4 gameweeks, 4 finished. GW1 single, GW2 double, GW3 blank, GW4 single.
 * Player 1 (team 1): xP 6, 9, –, 3.  Form 5.2, £8.5m, 34.5%, 40 pts.
 */
const data = decodeBootstrap({
  format: BOOTSTRAP_FORMAT,
  season: "2026-27",
  generatedAt: 0,
  currentGw: 4,
  nextGw: null,
  events: { deadline: [1, 2, 3, 4], finished: [1, 1, 1, 1] },
  teams: {
    id: [1, 2],
    code: [3, 4],
    name: ["Arsenal", "Brentford"],
    short: ["ARS", "BRE"],
    kit: [
      ["plain", "#f00", "#fff", "#ff0"],
      ["plain", "#f00", "#fff", "#ff0"],
    ],
  },
  players: {
    id: [1],
    code: [100],
    name: ["Saka"],
    team: [1],
    pos: [3],
    price: [85],
    status: "a",
    chance: [-1],
    news: [""],
    form: [52],
    sel: [345],
    pts: [40],
  },
  fixtures: {
    id: [1, 2, 3, 4],
    gw: [1, 2, 2, 4],
    h: [1, 1, 2, 2],
    a: [2, 2, 1, 1],
    hd: [2, 2, 3, 3],
    ad: [4, 4, 5, 5],
    ko: [0, 0, 0, 0],
    fin: [1, 1, 1, 1],
    hs: [0, 0, 0, 0],
    as: [0, 0, 0, 0],
  },
  xp: { gws: 4, values: [600, 900, -1, 300] },
});
const saka = data.playerById.get(1)!;

describe("metricPills", () => {
  it("shows fixtures by difficulty, two in a double", () => {
    expect(metricPills(data, saka, 1, "fixture")).toEqual({
      pills: [{ label: "BRE (H)", difficulty: 2 }],
      blank: false,
    });
    expect(metricPills(data, saka, 2, "fixture").pills.map((p) => p.label)).toEqual(["BRE", "bre"]);
  });

  it("colours projected points by value, and dashes a blank", () => {
    expect(metricPills(data, saka, 1, "xp").pills).toEqual([{ label: "6.0", difficulty: 1 }]);
    expect(metricPills(data, saka, 4, "xp").pills).toEqual([{ label: "3.0", difficulty: 3 }]);
    expect(metricPills(data, saka, 3, "xp")).toEqual({ pills: [], blank: true });
  });

  it("sums projected points over a range, rated per gameweek projected", () => {
    expect(xpOver(data, saka, 1, 3)).toEqual({ total: 15, gws: 2 });
    // A blank greys the player but still shows the range total.
    expect(metricPills(data, saka, 3, "xp3")).toEqual({
      pills: [{ label: "3.0", difficulty: 3 }],
      blank: true,
    });
    expect(metricPills(data, saka, 1, "xp5").pills).toEqual([{ label: "18.0", difficulty: 1 }]);
  });

  it("shows season stats, with price and ownership neutral", () => {
    expect(metricPills(data, saka, 1, "form").pills).toEqual([{ label: "5.2", difficulty: 2 }]);
    expect(metricPills(data, saka, 1, "price").pills).toEqual([{ label: "£8.5m", difficulty: null }]);
    expect(metricPills(data, saka, 1, "selected").pills).toEqual([{ label: "34.5%", difficulty: null }]);
    // 40 points over 4 finished gameweeks = 10 a gameweek.
    expect(metricPills(data, saka, 1, "points").pills).toEqual([{ label: "40", difficulty: 1 }]);
  });
});

describe("rateTier", () => {
  it("maps points per gameweek onto five tiers", () => {
    expect([7, 5, 3.5, 2, 0.5].map(rateTier)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("pastPills", () => {
  it("shows points and opponent per fixture, coloured by points", () => {
    expect(pastPills(data, saka, [{ fixture: 1, points: 12 }])).toEqual({
      pills: [{ label: "12 · BRE", difficulty: 1 }],
      blank: false,
    });
    // Away at Brentford, then home to them: short labels in a double.
    expect(
      pastPills(data, saka, [
        { fixture: 3, points: 2 },
        { fixture: 2, points: -1 },
      ]).pills,
    ).toEqual([
      { label: "2 bre", difficulty: 4 },
      { label: "-1 BRE", difficulty: 5 },
    ]);
  });

  it("greys out a blank", () => {
    expect(pastPills(data, saka, [])).toEqual({ pills: [], blank: true });
  });
});
