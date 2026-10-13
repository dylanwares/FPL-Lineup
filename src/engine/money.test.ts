import { describe, expect, it } from "vitest";
import { getRules } from "@/config/rules";
import { nextFreeTransfers, sellingPrice, transferCost } from "./money";

const rules = getRules();

describe("sellingPrice", () => {
  it("keeps half of a rise, rounded down", () => {
    expect(sellingPrice(50, 50)).toBe(50);
    expect(sellingPrice(50, 51)).toBe(50);
    expect(sellingPrice(50, 52)).toBe(51);
    expect(sellingPrice(50, 53)).toBe(51);
    expect(sellingPrice(50, 54)).toBe(52);
  });

  it("sells at the current price after a fall", () => {
    expect(sellingPrice(80, 77)).toBe(77);
  });
});

describe("nextFreeTransfers", () => {
  it("rolls over unused transfers up to the cap", () => {
    expect(nextFreeTransfers(1, 0, null, 8, rules)).toBe(2);
    expect(nextFreeTransfers(4, 0, null, 8, rules)).toBe(5);
    expect(nextFreeTransfers(5, 0, null, 8, rules)).toBe(5);
  });

  it("spends transfers, never going below zero before the weekly top-up", () => {
    expect(nextFreeTransfers(2, 1, null, 8, rules)).toBe(2);
    expect(nextFreeTransfers(1, 3, null, 8, rules)).toBe(1);
  });

  it("keeps saved transfers through a Wildcard or Free Hit", () => {
    expect(nextFreeTransfers(3, 9, "wildcard", 8, rules)).toBe(4);
    expect(nextFreeTransfers(5, 9, "freehit", 8, rules)).toBe(5);
  });

  it("applies one-off overrides from the rules", () => {
    const withTopUp = { ...rules, transfers: { ...rules.transfers, overrides: [{ gw: 16, setTo: 5 }] } };
    expect(nextFreeTransfers(1, 1, null, 16, withTopUp)).toBe(5);
    expect(nextFreeTransfers(1, 1, null, 17, withTopUp)).toBe(1);
  });
});

describe("transferCost", () => {
  it("charges 4 points per extra transfer", () => {
    expect(transferCost(1, 1, null, rules)).toBe(0);
    expect(transferCost(1, 3, null, rules)).toBe(8);
  });

  it("is free on a Wildcard or Free Hit", () => {
    expect(transferCost(1, 10, "wildcard", rules)).toBe(0);
    expect(transferCost(0, 10, "freehit", rules)).toBe(0);
  });
});
