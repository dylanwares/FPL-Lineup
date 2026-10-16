import { describe, expect, it } from "vitest";
import { InputError, parsePlan, parseVersion } from "./plan-input";

const ID = "6f1c2a9e-4b7d-4c1a-9f3e-2d5b8a7c6e10";
const valid = () => ({
  id: ID,
  entryId: 1,
  name: "  Main plan ",
  base: {
    gw: 7,
    slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, -15],
    captain: 9,
    vice: 8,
    bank: -3,
    freeTransfers: 2,
    purchase: { "1": 45 },
    chipsUsed: [{ name: "3xc", gw: 2 }],
  },
  moves: [
    { type: "transfer", gw: 7, out: 9, in: 99 },
    { type: "chip", gw: 8, chip: null },
    { type: "captain", gw: 7, player: 3 },
  ],
  createdAt: 1,
  updatedAt: 2,
  extra: "dropped",
});

describe("parsePlan", () => {
  it("accepts a well-formed plan, trimming the name and dropping unknown fields", () => {
    const plan = parsePlan(valid(), ID);
    expect(plan.name).toBe("Main plan");
    expect(plan).not.toHaveProperty("extra");
    expect(plan.base.purchase).toEqual({ 1: 45 });
    expect(plan.moves).toHaveLength(3);
  });

  it.each([
    [
      "an id that doesn't match the URL",
      (p: ReturnType<typeof valid>) => ({ ...p, id: "6f1c2a9e-0000-4c1a-9f3e-2d5b8a7c6e10" }),
    ],
    ["a long name", (p: ReturnType<typeof valid>) => ({ ...p, name: "x".repeat(41) })],
    ["a short squad", (p: ReturnType<typeof valid>) => ({ ...p, base: { ...p.base, slots: [1, 2] } })],
    ["an unknown move", (p: ReturnType<typeof valid>) => ({ ...p, moves: [{ type: "teleport", gw: 7 }] })],
    [
      "an unknown chip",
      (p: ReturnType<typeof valid>) => ({ ...p, moves: [{ type: "chip", gw: 7, chip: "x" }] }),
    ],
    ["a gameweek past 38", (p: ReturnType<typeof valid>) => ({ ...p, base: { ...p.base, gw: 39 } })],
    [
      "a fractional player id",
      (p: ReturnType<typeof valid>) => ({ ...p, base: { ...p.base, captain: 1.5 } }),
    ],
  ])("rejects %s", (_what, change) => {
    expect(() => parsePlan(change(valid()), ID)).toThrow(InputError);
  });
});

describe("parseVersion", () => {
  it("allows null (new to the server) or a positive integer", () => {
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(3)).toBe(3);
    expect(() => parseVersion(0)).toThrow(InputError);
    expect(() => parseVersion("2")).toThrow(InputError);
  });
});
