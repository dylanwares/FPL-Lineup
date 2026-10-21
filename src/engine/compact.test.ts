import { describe, expect, it } from "vitest";
import { compactPlanGw } from "./compact";
import { addMove, computePlan, stateAt } from "./plan";
import { canSwap } from "./squad";
import { testContext, testPlan } from "./testing";
import type { Move, Plan } from "./types";

const ctx = testContext();
// Squad: XI 1 | 3 4 5 6 | 8 9 10 11 | 13 14 · bench 2, 7, 12, 15. Captain 13, vice 8.

type Step = Move extends infer M ? (M extends Move ? Omit<M, "gw"> : never) : never;

/** Adds moves one at a time and compacts after each, as the planner does. */
function play(moves: readonly Step[], gw = 7): Plan {
  let plan = testPlan();
  for (const m of moves) {
    plan = addMove(plan, { ...m, gw } as Move);
    plan = compactPlanGw(plan, gw, computePlan(plan, ctx));
  }
  return plan;
}
const gwMoves = (plan: Plan, gw = 7) => plan.moves.filter((m) => m.gw === gw);

describe("compactPlanGw", () => {
  it("drops a sub that's swapped straight back, however many times", () => {
    const back = [
      { type: "sub", a: 13, b: 15 },
      { type: "sub", a: 15, b: 13 },
    ] as const;
    expect(gwMoves(play([...back, ...back, ...back]))).toEqual([]);
    // An odd number of swaps leaves just one.
    expect(gwMoves(play([...back, ...back, back[0]]))).toEqual([{ type: "sub", gw: 7, a: 13, b: 15 }]);
  });

  it("collapses a transfer chain into one transfer, and a buyback into nothing", () => {
    expect(
      gwMoves(
        play([
          { type: "transfer", out: 3, in: 18 },
          { type: "transfer", out: 18, in: 19 },
        ]),
      ),
    ).toEqual([{ type: "transfer", gw: 7, out: 3, in: 19 }]);
    expect(
      gwMoves(
        play([
          { type: "transfer", out: 3, in: 18 },
          { type: "transfer", out: 18, in: 3 },
        ]),
      ),
    ).toEqual([]);
  });

  it("keeps only the final armbands, and drops them if they end where they started", () => {
    expect(
      gwMoves(
        play([
          { type: "captain", player: 9 },
          { type: "captain", player: 10 },
          { type: "vice", player: 11 },
        ]),
      ),
    ).toEqual([
      { type: "captain", gw: 7, player: 10 },
      { type: "vice", gw: 7, player: 11 },
    ]);
    expect(
      gwMoves(
        play([
          { type: "captain", player: 9 },
          { type: "captain", player: 13 },
        ]),
      ),
    ).toEqual([]);
  });

  it("orders steps as you'd make them in FPL: transfers, then subs, then captain", () => {
    const plan = play([
      { type: "captain", player: 9 },
      { type: "sub", a: 14, b: 15 },
      { type: "transfer", out: 3, in: 18 },
    ]);
    expect(gwMoves(plan).map((m) => m.type)).toEqual(["transfer", "sub", "captain"]);
  });

  it("puts players straight into their final bench spots (no extra reordering)", () => {
    // Bench a midfielder for the bench defender, then another for the bench midfielder.
    const plan = play([
      { type: "sub", a: 9, b: 7 },
      { type: "sub", a: 12, b: 10 },
    ]);
    expect(gwMoves(plan)).toHaveLength(2);
    expect(stateAt(computePlan(plan, ctx), 7)!.slots.slice(11)).toEqual([2, 9, 10, 15]);
  });

  it("drops moves that no longer apply", () => {
    let plan = addMove(testPlan(), { type: "transfer", gw: 7, out: 99, in: 18 }); // 99 isn't in the squad
    plan = compactPlanGw(plan, 7, computePlan(plan, ctx));
    expect(gwMoves(plan)).toEqual([]);
  });

  it("never changes the outcome and never adds steps (random plans)", () => {
    let seed = 7;
    const rand = (n: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n;
    const pool: Record<string, number[]> = { DEF: [18, 19, 20], MID: [21, 22, 23, 24], FWD: [25, 26, 27] };

    for (let trial = 0; trial < 300; trial++) {
      let raw = testPlan();
      let compact = testPlan();
      const count = 1 + rand(12);
      for (let k = 0; k < count; k++) {
        const s = stateAt(computePlan(raw, ctx), 7)!;
        const a = s.slots[rand(15)];
        const b = s.slots[rand(15)];
        let move: Move | null = null;
        const kind = rand(4);
        if (kind === 0 && canSwap(s.slots, a, b, ctx.position, ctx.rules))
          move = { type: "sub", gw: 7, a, b };
        else if (kind === 1 && ctx.position(a) !== "GKP") {
          const options = pool[ctx.position(a)].filter((id) => !s.slots.includes(id));
          if (options.length) move = { type: "transfer", gw: 7, out: a, in: options[rand(options.length)] };
        } else if (kind === 2 && s.slots.indexOf(a) < 11) move = { type: "captain", gw: 7, player: a };
        else if (kind === 3 && s.slots.indexOf(a) < 11) move = { type: "vice", gw: 7, player: a };
        if (!move) continue;
        raw = addMove(raw, move);
        compact = addMove(compact, move);
        compact = compactPlanGw(compact, 7, computePlan(compact, ctx));
      }
      const r = stateAt(computePlan(raw, ctx), 7)!;
      const c = stateAt(computePlan(compact, ctx), 7)!;
      const xi = (slots: number[]) =>
        slots
          .slice(0, 11)
          .sort((x, y) => x - y)
          .join();
      expect(xi(c.slots)).toBe(xi(r.slots));
      expect(c.slots.slice(11)).toEqual(r.slots.slice(11));
      expect([c.captain, c.vice, c.bank, c.transfers, c.cost]).toEqual([
        r.captain,
        r.vice,
        r.bank,
        r.transfers,
        r.cost,
      ]);
      expect(gwMoves(compact).length).toBeLessThanOrEqual(gwMoves(raw).length);
      // Later gameweeks are unaffected.
      expect(xi(stateAt(computePlan(compact, ctx), 12)!.slots)).toBe(
        xi(stateAt(computePlan(raw, ctx), 12)!.slots),
      );
    }
  });
});

describe("compactPlanGw with edited prices", () => {
  it("keeps each typed price with its player when transfers are re-paired", () => {
    const plan = play([
      { type: "transfer", out: 3, in: 18, sellPrice: 50 },
      { type: "transfer", out: 18, in: 19, buyPrice: 66 },
    ]);
    expect(gwMoves(plan)).toEqual([{ type: "transfer", gw: 7, out: 3, in: 19, sellPrice: 50, buyPrice: 66 }]);
    expect(stateAt(computePlan(plan, ctx), 7)!.bank).toBe(10 + 50 - 66);
  });
});
