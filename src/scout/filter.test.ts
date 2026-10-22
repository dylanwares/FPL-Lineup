import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filtersFromSearch, filtersToSearch, scoutRows, type ScoutFilters } from "./filter";
import { scoutContext, visibleStats } from "./stats";
import { scoutTestData } from "./test-data";

const D = scoutTestData();
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

  it("narrows to the watchlist, with other filters still applying", () => {
    const watch = (f: Partial<ScoutFilters>, ids: number[]) =>
      scoutRows(ctx, { ...DEFAULT_FILTERS, watchlist: true, ...f }, undefined, new Set(ids)).map(
        (r) => r.player.name,
      );
    expect(watch({}, [2, 5, 99])).toEqual(["Fwd A", "Back"]); // unknown ids are ignored
    expect(watch({ pos: ["DEF"] }, [2, 5])).toEqual(["Back"]);
    expect(watch({}, [])).toEqual([]);
    expect(names({}).length).toBe(6); // off: everyone
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
      watchlist: true,
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
