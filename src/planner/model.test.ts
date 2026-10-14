import { describe, expect, it } from "vitest";
import { testPlan } from "@/engine/testing";
import { copyPlan, uniquePlanName } from "./model";

describe("uniquePlanName", () => {
  it("numbers a name that's taken, ignoring case", () => {
    const plans = [testPlan({ name: "New plan" }), testPlan({ name: "new plan 2" })];
    expect(uniquePlanName(plans, "Free hit")).toBe("Free hit");
    expect(uniquePlanName(plans, "New plan")).toBe("New plan 3");
  });
});

describe("copyPlan", () => {
  it("copies the snapshot and moves under a new id", () => {
    const plan = testPlan({ moves: [{ type: "captain", gw: 7, player: 8 }] });
    const copy = copyPlan(plan, "Copy", 5);
    expect(copy).toMatchObject({ name: "Copy", base: plan.base, moves: plan.moves, createdAt: 5 });
    expect(copy.id).not.toBe(plan.id);
  });
});
