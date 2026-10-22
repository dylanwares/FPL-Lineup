import { describe, expect, it } from "vitest";
import { KITS } from "@/config/kits";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "@/data/format";
import { DEFAULT_FILTERS, filtersFromSearch, filtersToSearch, scoutRows, type ScoutFilters } from "./filter";
import { scoutContext, visibleStats } from "./stats";

/**
 * Three teams, GW7 next. Alpha doubles in GW7, Gamma blanks in GW8.
 * xP in GW7 is the player's price / 10; Fwd Z has no projection.
 */
const K = KITS[3];
function data() {
  type P = [id: number, name: string, team: number, pos: number, price: number, status: string];
  const players: P[] = [
    [1, "Keeper", 1, 1, 45, "a"],
    [2, "Back", 2, 2, 50, "a"],
    [3, "Ødegaard", 1, 3, 85, "d"],
    [4, "Injured Mid", 2, 3, 60, "i"],
    [5, "Fwd A", 3, 4, 90, "a"],
    [6, "Fwd Z", 2, 4, 60, "a"],
  ];
  const n = players.length;
  const k = K;
  const file: BootstrapFile = {
    format: BOOTSTRAP_FORMAT,
    season: "2026-27",
    generatedAt: 0,
    currentGw: 6,
    nextGw: 7,
    events: { deadline: Array(38).fill(0), finished: Array.from({ length: 38 }, (_, i) => (i < 6 ? 1 : 0)) },
    teams: {
      id: [1, 2, 3],
      code: [3, 14, 43],
      name: ["Alpha", "Beta", "Gamma"],
      short: ["ALP", "BET", "GAM"],
      kit: Array(3).fill(["plain", k.primary, k.secondary, k.gk]),
    },
    players: {
      id: players.map((p) => p[0]),
      code: players.map((p) => p[0]),
      name: players.map((p) => p[1]),
      team: players.map((p) => p[2]),
      pos: players.map((p) => p[3]),
      price: players.map((p) => p[4]),
      status: players.map((p) => p[5]).join(""),
      chance: Array(n).fill(-1),
      news: Array(n).fill(""),
      form: Array(n).fill(0),
      sel: [300, 50, 400, 10, 150, 20], // ×10
      pts: [30, 20, 50, 5, 45, 0],
      stats: {
        minutes: [540, 450, 500, 60, 400, 0],
        goals: [0, 1, 4, 0, 6, 0],
        xg: [0, 50, 300, 0, 650, 0], // ×100
        penOrder: [0, 0, 1, 0, 0, 0],
        cornerOrder: [0, 1, 0, 0, 0, 0],
      },
    },
    // GW7: ALP v BET and ALP v GAM (Alpha's double). GW8: ALP v BET (Gamma blanks).
    fixtures: {
      id: [1, 2, 3],
      gw: [7, 7, 8],
      h: [1, 1, 1],
      a: [2, 3, 2],
      hd: [2, 2, 2],
      ad: [4, 4, 4],
      ko: [1, 2, 3],
      fin: [0, 0, 0],
      hs: [-1, -1, -1],
      as: [-1, -1, -1],
    },
    xp: {
      gws: 38,
      values: players.flatMap((p) =>
        Array.from({ length: 38 }, (_, g) => (g === 6 && p[0] !== 6 ? p[4] * 10 : -1)),
      ),
    },
  };
  return decodeBootstrap(file);
}

const D = data();
const ctx = scoutContext(D);
const names = (f: Partial<ScoutFilters>, owned?: Set<number>) =>
  scoutRows(ctx, { ...DEFAULT_FILTERS, ...f }, owned).map((r) => r.player.name);

describe("scoutRows", () => {
  it("sorts by the stat's natural order, unknown values last", () => {
    expect(names({ sort: "xp1" })).toEqual(["Fwd A", "Ødegaard", "Injured Mid", "Back", "Keeper", "Fwd Z"]);
    expect(names({ sort: "xp1", reverse: true })).toEqual([
      "Keeper",
      "Back",
      "Injured Mid",
      "Ødegaard",
      "Fwd A",
      "Fwd Z",
    ]);
    // Fixture run: lower is easier, so it sorts ascending. Alpha (double, easy) first; ties by price.
    expect(names({ sort: "run" }).slice(0, 2)).toEqual(["Ødegaard", "Keeper"]);
  });

  it("filters by position, price, ownership and minutes", () => {
    expect(names({ pos: ["MID", "FWD"], sort: "price" })).toEqual([
      "Fwd A",
      "Ødegaard",
      "Fwd Z",
      "Injured Mid",
    ]);
    expect(names({ minPrice: 60, maxPrice: 85, sort: "price" })).toEqual([
      "Ødegaard",
      "Fwd Z",
      "Injured Mid",
    ]);
    expect(names({ maxOwned: 5, sort: "price" })).toEqual(["Fwd Z", "Injured Mid", "Back"]);
    expect(names({ minMinutes: 450, sort: "price" })).toEqual(["Ødegaard", "Back", "Keeper"]);
  });

  it("filters by availability, set pieces and fixtures", () => {
    expect(names({ available: true })).not.toContain("Injured Mid");
    expect(names({ available: true })).toContain("Ødegaard"); // doubtful stays
    expect(names({ setPiece: "pen" })).toEqual(["Ødegaard"]);
    expect(names({ setPiece: "any", sort: "price" })).toEqual(["Ødegaard", "Back"]);
    expect(names({ fixtures: "double", sort: "price" })).toEqual(["Ødegaard", "Keeper"]);
    expect(names({ fixtures: "noBlank" })).not.toContain("Fwd A");
  });

  it("searches names without accents, or a club by name", () => {
    expect(names({ query: "odegaard" })).toEqual(["Ødegaard"]);
    expect(names({ query: "bet", sort: "price" })).toEqual(["Fwd Z", "Injured Mid", "Back"]);
    expect(names({ query: "Gamma" })).toEqual(["Fwd A"]);
  });

  it("marks or hides the plan's squad", () => {
    const owned = new Set([3, 5]);
    expect(
      scoutRows(ctx, DEFAULT_FILTERS, owned)
        .filter((r) => r.owned)
        .map((r) => r.player.id),
    ).toEqual([5, 3]);
    expect(names({ hideOwned: true }, owned)).toEqual(["Injured Mid", "Back", "Keeper", "Fwd Z"]);
  });
});

describe("stats", () => {
  it("leaves per-90 unknown under 90 minutes", () => {
    const xg90 = (id: number) =>
      scoutRows(ctx, { ...DEFAULT_FILTERS, sort: "xg90" }).findIndex((r) => r.player.id === id);
    expect(xg90(5)).toBe(0); // 6.5 xG in 400 mins
    expect(xg90(4)).toBeGreaterThan(xg90(1)); // 60 mins: unknown, so last-but-ties
  });

  it("swaps the sort stat into the last column when the preset lacks it", () => {
    expect(visibleStats("overview", "xp5")).toEqual(["xp1", "xp5", "form", "points"]);
    expect(visibleStats("overview", "xg")).toEqual(["xp1", "xp5", "form", "xg"]);
  });
});

describe("URL", () => {
  it("round-trips non-default filters and leaves defaults out", () => {
    expect(filtersToSearch(D, DEFAULT_FILTERS)).toBe("");
    const f: ScoutFilters = {
      ...DEFAULT_FILTERS,
      query: "salah",
      pos: ["DEF", "MID"],
      team: 2,
      minPrice: 45,
      maxPrice: 80,
      maxOwned: 10,
      minMinutes: 270,
      available: true,
      setPiece: "pen",
      fixtures: "double",
      hideOwned: true,
      sort: "xgi90",
      reverse: true,
      cols: "attack",
    };
    const search = filtersToSearch(D, f);
    expect(search).toContain("team=BET");
    expect(search).toContain("max=8.0");
    expect(filtersFromSearch(D, search)).toEqual(f);
  });

  it("ignores junk", () => {
    expect(filtersFromSearch(D, "?sort=nope&cols=x&team=ZZZ&min=abc&pos=XYZ&sp=1")).toEqual(DEFAULT_FILTERS);
  });
});
