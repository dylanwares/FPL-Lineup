import { describe, expect, it } from "vitest";
import { getRules } from ".";

describe("season rules", () => {
  const rules = getRules();

  it("has a consistent squad shape", () => {
    const positions = Object.values(rules.squad.positions);
    expect(positions.reduce((n, p) => n + p.squad, 0)).toBe(rules.squad.size);
    expect(positions.reduce((n, p) => n + p.minPlay, 0)).toBeLessThanOrEqual(rules.squad.starters);
    for (const p of positions) expect(p.maxPlay).toBeLessThanOrEqual(p.squad);
  });

  it("has two of each chip in non-overlapping windows inside the season", () => {
    for (const name of ["wildcard", "freehit", "bboost", "3xc"] as const) {
      const windows = rules.chips.filter((c) => c.name === name).map((c) => c.window);
      expect(windows).toHaveLength(2);
      const [a, b] = windows.sort((x, y) => x.start - y.start);
      expect(a.stop).toBeLessThan(b.start);
      expect(a.start).toBeGreaterThanOrEqual(rules.firstGw);
      expect(b.stop).toBeLessThanOrEqual(rules.lastGw);
    }
  });

  it("throws for an unknown season", () => {
    expect(() => getRules("1999-00")).toThrow();
  });
});
