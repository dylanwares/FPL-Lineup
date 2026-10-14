import { describe, expect, it } from "vitest";
import { cancelChip, chipStatus, playChip } from "./chips";
import { computePlan, stateAt } from "./plan";
import { testContext, testPlan, testSnapshot } from "./testing";
import type { Move, Plan } from "./types";

const ctx = testContext();
const withMoves = (moves: Move[], base = testSnapshot()): Plan => testPlan({ base, moves });
const run = (plan: Plan) => computePlan(plan, ctx);

describe("chipStatus", () => {
  it("shows played, available and real uses", () => {
    const r = run(
      withMoves(
        [{ type: "chip", gw: 7, chip: "3xc" }],
        testSnapshot({ chipsUsed: [{ name: "bboost", gw: 3 }] }),
      ),
    );
    expect(chipStatus("3xc", 7, r)).toEqual({ kind: "played" });
    expect(chipStatus("wildcard", 7, r)).toEqual({ kind: "available" });
    expect(chipStatus("bboost", 7, r)).toEqual({ kind: "used", gw: 3 });
    // The second-half copy is untouched.
    expect(chipStatus("bboost", 20, r)).toEqual({ kind: "available" });
  });

  it("shows a chip planned later in the same half as planned, not available", () => {
    const r = run(withMoves([{ type: "chip", gw: 10, chip: "bboost" }]));
    expect(chipStatus("bboost", 8, r)).toEqual({ kind: "planned", gws: [10] });
    // And an earlier plan from a later gameweek.
    expect(chipStatus("bboost", 12, r)).toEqual({ kind: "planned", gws: [10] });
    // A plan in the other half doesn't clash.
    expect(chipStatus("bboost", 25, r)).toEqual({ kind: "available" });
  });

  it("treats a Free Hit the gameweek before or after as planned", () => {
    const base = testSnapshot({ gw: 18 });
    const r = run(withMoves([{ type: "chip", gw: 20, chip: "freehit" }], base));
    expect(chipStatus("freehit", 19, r)).toEqual({ kind: "planned", gws: [20] });
    expect(chipStatus("freehit", 21, r)).toEqual({ kind: "planned", gws: [20] });
    expect(chipStatus("freehit", 22, r)).toEqual({ kind: "planned", gws: [20] }); // same half
  });

  it("explains when a chip can't be played yet", () => {
    const base = testSnapshot({ gw: 1, chipsUsed: [] });
    const r = run(withMoves([], base));
    expect(chipStatus("wildcard", 1, r)).toEqual({ kind: "unavailable", from: 2 });
    const afterFh = run(withMoves([], testSnapshot({ gw: 8, chipsUsed: [{ name: "freehit", gw: 7 }] })));
    // The first-half copy is gone, so it's used rather than blocked.
    expect(chipStatus("freehit", 8, afterFh)).toEqual({ kind: "used", gw: 7 });
    const afterFh19 = run(withMoves([], testSnapshot({ gw: 20, chipsUsed: [{ name: "freehit", gw: 19 }] })));
    expect(chipStatus("freehit", 20, afterFh19)).toEqual({ kind: "unavailable", from: 21 });
  });
});

describe("playChip / cancelChip", () => {
  it("plays a chip, replacing another chip that gameweek", () => {
    const plan = withMoves([{ type: "chip", gw: 7, chip: "3xc" }]);
    const out = playChip(plan, "bboost", 7, run(plan), 1)!;
    expect(out.movedFrom).toEqual([]);
    expect(stateAt(run(out.plan), 7)!.chip).toBe("bboost");
    expect(out.plan.moves.filter((m) => m.type === "chip")).toHaveLength(1);
  });

  it("moves a clashing plan of the same chip", () => {
    const plan = withMoves([
      { type: "chip", gw: 10, chip: "bboost" },
      { type: "chip", gw: 25, chip: "bboost" },
    ]);
    const out = playChip(plan, "bboost", 8, run(plan), 1)!;
    expect(out.movedFrom).toEqual([10]);
    const r = run(out.plan);
    expect(stateAt(r, 8)!.chip).toBe("bboost");
    expect(stateAt(r, 10)!.chip).toBeNull();
    expect(stateAt(r, 10)!.warnings).toEqual([]);
    expect(stateAt(r, 25)!.chip).toBe("bboost");
  });

  it("refuses a chip that's used for real", () => {
    const plan = withMoves([], testSnapshot({ chipsUsed: [{ name: "wildcard", gw: 3 }] }));
    expect(playChip(plan, "wildcard", 7, run(plan))).toBeNull();
  });

  it("cancels a gameweek's chip", () => {
    const plan = withMoves([{ type: "chip", gw: 9, chip: "wildcard" }]);
    expect(stateAt(run(cancelChip(plan, 9)), 9)!.chip).toBeNull();
    expect(cancelChip(plan, 8)).toBe(plan);
  });
});
