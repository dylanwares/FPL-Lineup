import { describe, expect, it } from "vitest";
import type { GwState } from "@/engine/types";
import { scoutTestData } from "./test-data";
import { transferOptions } from "./transfer";

const D = scoutTestData();
const player = (id: number) => D.playerById.get(id)!;

/** Keeper (ALP), Back, Injured Mid (bought at £5.5m), Fwd A, and Ødegaard's slot left empty. */
const state = {
  gw: 7,
  slots: [1, 2, 4, 5, -3],
  bank: 10,
  purchase: { 4: 55 },
} as unknown as GwState;

describe("transferOptions", () => {
  it("offers same-position slots, empty ones first, with budgets", () => {
    const options = transferOptions(D, state, player(3), 3)!;
    expect(options.map((o) => [o.out, o.empty, o.budget])).toEqual([
      [-3, true, 10],
      [4, false, 67], // bank + £5.7m selling price (half the £0.5m rise, rounded down)
    ]);
    expect(options[0].outPlayer.name).toBe("Ødegaard");
    expect(options[1].reasons).toEqual(["£1.8m over budget"]);
  });

  it("flags breaking the club limit", () => {
    const options = transferOptions(D, { ...state, bank: 200 }, player(3), 1)!;
    expect(options.every((o) => o.reasons.join().includes("from ALP"))).toBe(true);
  });

  it("only matches the position, and is null for a player already in the squad", () => {
    expect(transferOptions(D, state, player(6), 3)!.map((o) => o.out)).toEqual([5]);
    expect(transferOptions(D, state, player(4), 3)).toBeNull();
  });
});
