import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filtersFromSearch, filtersToSearch, scoutRows } from "./filter";
import { matchingReport, REPORTS } from "./reports";
import { scoutContext } from "./stats";
import { scoutTestData } from "./test-data";

const D = scoutTestData();

describe("reports", () => {
  it("have unique ids and survive a trip through the URL", () => {
    expect(new Set(REPORTS.map((r) => r.id)).size).toBe(REPORTS.length);
    for (const r of REPORTS) {
      expect(matchingReport(filtersFromSearch(D, filtersToSearch(D, r.filters)))?.id).toBe(r.id);
    }
  });

  it("match regardless of the search box, watchlist or position order, and not otherwise", () => {
    const threat = REPORTS.find((r) => r.id === "threat")!;
    expect(matchingReport({ ...threat.filters, query: "x", pos: ["FWD", "MID"] })?.id).toBe("threat");
    expect(matchingReport({ ...threat.filters, watchlist: true })?.id).toBe("threat");
    expect(matchingReport({ ...threat.filters, minMinutes: 0 })).toBeNull();
    expect(matchingReport(DEFAULT_FILTERS)).toBeNull();
  });

  it("filter as described", () => {
    const pens = REPORTS.find((r) => r.id === "pens")!;
    expect(scoutRows(scoutContext(D), pens.filters).map((r) => r.player.name)).toEqual(["Ødegaard"]);
  });
});
