import { describe, expect, it } from "vitest";
import { addMove, computePlan, removeMove, resetGw, stateAt, undoMove } from "./plan";
import { PRICES, testContext, testPlan, testSnapshot } from "./testing";
import type { Move, Plan } from "./types";

const ctx = testContext();
const withMoves = (moves: Move[], base = testSnapshot()): Plan => testPlan({ base, moves });
const run = (plan: Plan) => computePlan(plan, ctx);

describe("computePlan basics", () => {
  it("covers every gameweek from the base to GW38", () => {
    const { states } = run(testPlan());
    expect(states).toHaveLength(38 - 7 + 1);
    expect(states[0].gw).toBe(7);
    expect(states.at(-1)!.gw).toBe(38);
  });

  it("rolls free transfers over up to the cap", () => {
    const r = run(testPlan());
    expect([7, 8, 9, 10, 11, 12].map((gw) => stateAt(r, gw)!.freeTransfers)).toEqual([1, 2, 3, 4, 5, 5]);
  });
});

describe("transfers", () => {
  it("updates bank, count and carries forward", () => {
    // Sell DEF 3 (bought at 5.3, now 5.3) for DEF 18 (6.8).
    const r = run(withMoves([{ type: "transfer", gw: 7, out: 3, in: 18 }]));
    const gw7 = stateAt(r, 7)!;
    expect(gw7.transfers).toBe(1);
    expect(gw7.cost).toBe(0);
    expect(gw7.bank).toBe(10 + PRICES[3] - PRICES[18]);
    expect(gw7.slots[1]).toBe(18);
    expect(gw7.purchase[18]).toBe(PRICES[18]);
    expect(gw7.purchase[3]).toBeUndefined();

    const gw10 = stateAt(r, 10)!;
    expect(gw10.slots[1]).toBe(18);
    expect(gw10.bank).toBe(gw7.bank);
    expect(gw10.freeTransfers).toBe(3); // 0 left after GW7, then +1 ×3
  });

  it("sells at the selling price, not the current price", () => {
    const risen = testContext({ prices: { 3: 60 } }); // bought at 53, now 60 → sells for 56
    const r = computePlan(withMoves([{ type: "transfer", gw: 7, out: 3, in: 18 }]), risen);
    expect(stateAt(r, 7)!.bank).toBe(10 + 56 - PRICES[18]);
  });

  it("charges a hit for transfers beyond the free ones", () => {
    const r = run(
      withMoves([
        { type: "transfer", gw: 7, out: 3, in: 18 },
        { type: "transfer", gw: 7, out: 13, in: 25 },
      ]),
    );
    expect(stateAt(r, 7)!).toMatchObject({ transfers: 2, cost: 4 });
    expect(stateAt(r, 8)!.freeTransfers).toBe(1);
  });

  it("counts a chain A→B→C as one transfer", () => {
    const r = run(
      withMoves([
        { type: "transfer", gw: 7, out: 3, in: 18 },
        { type: "transfer", gw: 7, out: 18, in: 19 },
      ]),
    );
    const gw7 = stateAt(r, 7)!;
    expect(gw7).toMatchObject({ transfers: 1, sold: [3], bought: [19] });
    expect(gw7.bank).toBe(10 + PRICES[3] - PRICES[19]);
  });

  it("cancels a buyback: price, transfer and hit are all restored", () => {
    const risen = testContext({ prices: { 3: 60 } });
    const r = computePlan(
      withMoves([
        { type: "transfer", gw: 7, out: 13, in: 25 },
        { type: "transfer", gw: 7, out: 3, in: 18 },
        { type: "transfer", gw: 7, out: 18, in: 3 },
      ]),
      risen,
    );
    const gw7 = stateAt(r, 7)!;
    expect(gw7).toMatchObject({ transfers: 1, cost: 0 });
    expect(gw7.purchase[3]).toBe(PRICES[3]); // original purchase price kept
    expect(gw7.bank).toBe(10 + PRICES[13] - PRICES[25]);
  });

  it("lets the bank go negative with a warning", () => {
    const r = run(withMoves([{ type: "transfer", gw: 7, out: 3, in: 20 }], testSnapshot({ bank: 0 })));
    expect(stateAt(r, 7)!.bank).toBe(PRICES[3] - PRICES[20]);
    expect(stateAt(r, 7)!.warnings).toContainEqual({ kind: "over-budget", amount: PRICES[20] - PRICES[3] });
  });

  it("warns about a fourth player from one club", () => {
    const sameClub = testContext({ teams: { 3: 99, 4: 99, 5: 99, 18: 99 } });
    const r = computePlan(withMoves([{ type: "transfer", gw: 7, out: 6, in: 18 }]), sameClub);
    expect(stateAt(r, 7)!.warnings).toContainEqual({ kind: "club-limit", team: 99, count: 4 });
  });

  it("rejects transfers across positions or of players not owned", () => {
    const r = run(
      withMoves([
        { type: "transfer", gw: 7, out: 3, in: 25 },
        { type: "transfer", gw: 7, out: 99, in: 18 },
      ]),
    );
    const gw7 = stateAt(r, 7)!;
    expect(gw7.transfers).toBe(0);
    expect(gw7.warnings.filter((w) => w.kind === "invalid-move")).toHaveLength(2);
  });

  it("passes the armband to the incoming player", () => {
    const r = run(withMoves([{ type: "transfer", gw: 7, out: 13, in: 25 }]));
    expect(stateAt(r, 7)!.captain).toBe(25);
  });
});

describe("chips", () => {
  it("makes Wildcard transfers free and keeps saved transfers", () => {
    const r = run(
      withMoves(
        [
          { type: "chip", gw: 7, chip: "wildcard" },
          { type: "transfer", gw: 7, out: 3, in: 18 },
          { type: "transfer", gw: 7, out: 13, in: 25 },
        ],
        testSnapshot({ freeTransfers: 2 }),
      ),
    );
    expect(stateAt(r, 7)!).toMatchObject({ chip: "wildcard", transfers: 2, cost: 0 });
    expect(stateAt(r, 8)!.freeTransfers).toBe(2); // the 2 saved are kept, no extra one
    expect(stateAt(r, 8)!.slots).toContain(18); // wildcard changes stick
  });

  it("reverts the squad and bank after a Free Hit", () => {
    const r = run(
      withMoves([
        { type: "chip", gw: 7, chip: "freehit" },
        { type: "transfer", gw: 7, out: 3, in: 20 },
        { type: "captain", gw: 7, player: 20 },
      ]),
    );
    const gw7 = stateAt(r, 7)!;
    expect(gw7).toMatchObject({ chip: "freehit", cost: 0, captain: 20 });
    const gw8 = stateAt(r, 8)!;
    expect(gw8.slots).toEqual(testSnapshot().slots);
    expect(gw8.captain).toBe(13);
    expect(gw8.bank).toBe(10);
    expect(gw8.freeTransfers).toBe(1); // the 1 saved is kept, no extra one
  });

  it("flags more than 20 transfers in a gameweek, except on a Wildcard or Free Hit", () => {
    const strict = { ...ctx, rules: { ...ctx.rules, transfers: { ...ctx.rules.transfers, maxPerGw: 1 } } };
    const moves: Move[] = [
      { type: "transfer", gw: 7, out: 3, in: 18 },
      { type: "transfer", gw: 7, out: 13, in: 25 },
    ];
    expect(stateAt(computePlan(withMoves(moves), strict), 7)!.warnings).toContainEqual({
      kind: "transfer-limit",
      count: 2,
      max: 1,
    });
    const wildcard = withMoves([{ type: "chip", gw: 7, chip: "wildcard" }, ...moves]);
    expect(stateAt(computePlan(wildcard, strict), 7)!.warnings).not.toContainEqual(
      expect.objectContaining({ kind: "transfer-limit" }),
    );
  });

  it("won't play a Free Hit in consecutive gameweeks", () => {
    const base = testSnapshot({ gw: 19 });
    const r = run(
      withMoves(
        [
          { type: "chip", gw: 19, chip: "freehit" },
          { type: "chip", gw: 20, chip: "freehit" },
        ],
        base,
      ),
    );
    expect(stateAt(r, 19)!.chip).toBe("freehit");
    expect(stateAt(r, 20)!.chip).toBeNull();
    expect(stateAt(r, 20)!.warnings[0]).toMatchObject({ kind: "invalid-move" });
  });

  it("rejects a chip that has been used in this half", () => {
    const base = testSnapshot({ chipsUsed: [{ name: "bboost", gw: 3 }] });
    const r = run(withMoves([{ type: "chip", gw: 7, chip: "bboost" }], base));
    expect(stateAt(r, 7)!.chip).toBeNull();
    expect(stateAt(r, 7)!.warnings[0]).toMatchObject({ kind: "invalid-move" });
  });

  it("records chips so later gameweeks see them as used", () => {
    const r = run(withMoves([{ type: "chip", gw: 7, chip: "3xc" }]));
    expect(stateAt(r, 12)!.chipsUsed).toEqual([{ name: "3xc", gw: 7 }]);
  });
});

describe("captaincy and subs", () => {
  it("carries the captain forward and swaps C/V when needed", () => {
    const r = run(withMoves([{ type: "captain", gw: 8, player: 8 }]));
    expect(stateAt(r, 7)!.captain).toBe(13);
    expect(stateAt(r, 8)!).toMatchObject({ captain: 8, vice: 13 });
    expect(stateAt(r, 20)!).toMatchObject({ captain: 8, vice: 13 });
  });

  it("only gives the armband to starters", () => {
    const r = run(withMoves([{ type: "captain", gw: 7, player: 15 }]));
    expect(stateAt(r, 7)!.captain).toBe(13);
  });

  it("swaps a starter with a bench player and hands over the armband", () => {
    const r = run(withMoves([{ type: "sub", gw: 7, a: 13, b: 15 }]));
    const gw7 = stateAt(r, 7)!;
    expect(gw7.slots[9]).toBe(15);
    expect(gw7.slots[14]).toBe(13);
    expect(gw7.captain).toBe(15);
  });
});

describe("incremental recompute", () => {
  it("reuses gameweeks before the earliest change", () => {
    const plan = testPlan();
    const first = run(plan);
    const edited = addMove(plan, { type: "captain", gw: 12, player: 9 });
    const second = computePlan(edited, ctx, first);
    for (let gw = 7; gw < 12; gw++) expect(stateAt(second, gw)).toBe(stateAt(first, gw));
    expect(stateAt(second, 12)).not.toBe(stateAt(first, 12));
    expect(stateAt(second, 30)!.captain).toBe(9);
    // Same result as a full recompute.
    expect(second.states).toEqual(run(edited).states);
  });
});

describe("editing", () => {
  it("replaces earlier captain moves in the same gameweek", () => {
    let plan = addMove(testPlan(), { type: "captain", gw: 7, player: 8 });
    plan = addMove(plan, { type: "captain", gw: 7, player: 9 });
    expect(plan.moves).toEqual([{ type: "captain", gw: 7, player: 9 }]);
  });

  it("removes a single move; a later move that depended on it is flagged, not applied", () => {
    let plan = addMove(testPlan(), { type: "transfer", gw: 7, out: 3, in: 18 });
    plan = addMove(plan, { type: "transfer", gw: 7, out: 18, in: 19 }); // chain: 3 → 18 → 19
    plan = addMove(plan, { type: "captain", gw: 7, player: 8 });

    const withoutFirst = removeMove(plan, 0);
    expect(withoutFirst.moves).toHaveLength(2);
    const gw7 = stateAt(computePlan(withoutFirst, ctx), 7)!;
    expect(gw7.slots).toContain(3); // the original defender stays
    expect(gw7.captain).toBe(8); // unrelated moves still apply
    expect(gw7.warnings).toContainEqual(
      expect.objectContaining({ kind: "invalid-move", move: withoutFirst.moves[0] }),
    );
    expect(removeMove(plan, 9)).toBe(plan); // out of range: unchanged
  });

  it("undoes and resets", () => {
    let plan = addMove(testPlan(), { type: "transfer", gw: 7, out: 3, in: 18 });
    plan = addMove(plan, { type: "transfer", gw: 8, out: 4, in: 19 });
    expect(undoMove(plan).moves).toHaveLength(1);
    expect(resetGw(plan, 7).moves).toEqual([{ type: "transfer", gw: 8, out: 4, in: 19 }]);
  });
});

describe("removing players", () => {
  it("sells the player into the bank and leaves an empty slot", () => {
    const r = run(withMoves([{ type: "remove", gw: 7, player: 3 }]));
    const gw7 = stateAt(r, 7)!;
    expect(gw7.slots[1]).toBe(-3);
    expect(gw7.bank).toBe(10 + PRICES[3]);
    expect(gw7.purchase[3]).toBeUndefined();
    expect(gw7).toMatchObject({ transfers: 0, cost: 0, sold: [3], bought: [], warnings: [] });
    expect(stateAt(r, 9)!.slots[1]).toBe(-3);
  });

  it("sells at the selling price", () => {
    const risen = testContext({ prices: { 3: 60 } });
    const r = computePlan(withMoves([{ type: "remove", gw: 7, player: 3 }]), risen);
    expect(stateAt(r, 7)!.bank).toBe(10 + 56);
  });

  it("fills the empty slot with a transfer later, which counts as one", () => {
    const r = run(
      withMoves([
        { type: "remove", gw: 7, player: 3 },
        { type: "transfer", gw: 8, out: -3, in: 18 },
      ]),
    );
    const gw8 = stateAt(r, 8)!;
    expect(gw8.slots[1]).toBe(18);
    expect(gw8.bank).toBe(10 + PRICES[3] - PRICES[18]);
    expect(gw8).toMatchObject({ transfers: 1, sold: [], bought: [18] });
  });

  it("passes the armband on via the empty slot", () => {
    const r = run(
      withMoves([
        { type: "remove", gw: 7, player: 13 },
        { type: "transfer", gw: 7, out: -13, in: 25 },
      ]),
    );
    expect(stateAt(r, 7)!.captain).toBe(25);
  });

  it("rejects removing a player who isn't in the squad, or an empty slot", () => {
    const r = run(
      withMoves([
        { type: "remove", gw: 7, player: 18 },
        { type: "remove", gw: 7, player: 3 },
        { type: "remove", gw: 7, player: -3 },
      ]),
    );
    expect(stateAt(r, 7)!.warnings.filter((w) => w.kind === "invalid-move")).toHaveLength(2);
  });
});
