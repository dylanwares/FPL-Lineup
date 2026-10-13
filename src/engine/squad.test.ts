import { describe, expect, it } from "vitest";
import { chipAvailability } from "./chips";
import { canSwap, formationRows, isValidLineup } from "./squad";
import { testContext, testSnapshot } from "./testing";

const ctx = testContext();
const { slots } = testSnapshot(); // XI 1 | 3 4 5 6 | 8 9 10 11 | 13 14 · bench 2, 7, 12, 15
const swap = (a: number, b: number, s = slots) => canSwap(s, a, b, ctx.position, ctx.rules);

describe("canSwap", () => {
  it("does not offer starter ↔ starter swaps", () => {
    expect(swap(3, 8)).toBe(false);
  });

  it("only swaps goalkeepers with goalkeepers", () => {
    expect(swap(1, 2)).toBe(true);
    expect(swap(1, 7)).toBe(false);
    expect(swap(2, 7)).toBe(false); // bench GK slot is fixed
  });

  it("reorders outfield bench players", () => {
    expect(swap(7, 12)).toBe(true);
    expect(swap(12, 15)).toBe(true);
  });

  it("allows starter ↔ bench swaps that keep a valid formation", () => {
    expect(swap(3, 7)).toBe(true); // DEF for DEF
    expect(swap(8, 15)).toBe(true); // 4-3-3
    expect(swap(3, 12)).toBe(true); // 3-5-2
  });

  it("rejects swaps that break the formation", () => {
    // 3-5-2: benching another defender would leave two.
    const threeAtBack = [1, 12, 4, 5, 6, 8, 9, 10, 11, 13, 14, 2, 7, 3, 15];
    expect(swap(4, 15, threeAtBack)).toBe(false);
    // 4-4-2 → benching a forward for a defender is fine (5-4-1)…
    expect(swap(13, 7)).toBe(true);
    // …but not leaving no forwards.
    const oneUpFront = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 2, 12, 14, 15];
    expect(swap(13, 12, oneUpFront)).toBe(false);
  });

  it("rejects players not in the squad", () => {
    expect(swap(3, 99)).toBe(false);
  });
});

describe("formation", () => {
  it("validates line-ups", () => {
    expect(isValidLineup(slots, ctx.position, ctx.rules)).toBe(true);
    const twoGks = [1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14, 3, 7, 12, 15];
    expect(isValidLineup(twoGks, ctx.position, ctx.rules)).toBe(false);
  });

  it("groups the XI into pitch rows", () => {
    expect(formationRows(slots, ctx.position)).toEqual([[1], [3, 4, 5, 6], [8, 9, 10, 11], [13, 14]]);
  });
});

describe("chipAvailability", () => {
  const rules = ctx.rules;

  it("respects chip windows", () => {
    expect(chipAvailability("wildcard", 1, [], rules)).toBe("unavailable");
    expect(chipAvailability("wildcard", 2, [], rules)).toBe("available");
    expect(chipAvailability("3xc", 1, [], rules)).toBe("available");
  });

  it("uses up one copy per half", () => {
    const used = [{ name: "bboost" as const, gw: 4 }];
    expect(chipAvailability("bboost", 10, used, rules)).toBe("used");
    expect(chipAvailability("bboost", 20, used, rules)).toBe("available");
    expect(chipAvailability("3xc", 10, used, rules)).toBe("available");
  });
});
