import { describe, expect, it } from "vitest";
import { getRules } from "@/config/rules";
import fixture from "./__fixtures__/entry-1.json";
import { buildTeamImport, deriveFreeTransfers, TeamImportError } from "./build-import";
import type { FplBootstrapSlim, FplEntry, FplHistory, FplPicks, FplTransfer } from "./types";

/**
 * Real FPL responses for entry 1 after GW6 (names replaced): Bench Boost GW2,
 * Wildcard GW3, Free Hit GW5, one transfer in GW6.
 */
const input = {
  entry: fixture.entry as FplEntry,
  history: fixture.history as FplHistory,
  transfers: fixture.transfers as FplTransfer[],
  picks: fixture.picks as FplPicks,
  bootstrap: fixture.bootstrap as FplBootstrapSlim,
};
const rules = getRules();

describe("buildTeamImport", () => {
  const team = buildTeamImport(input, rules, 1_000);

  it("reads the squad in slot order with the armbands", () => {
    expect(team.slots).toEqual([82, 8, 277, 114, 124, 154, 12, 368, 165, 411, 569, 302, 31, 565, 387]);
    expect(team.captain).toBe(12);
    expect(team.vice).toBe(154);
    expect(team).toMatchObject({ currentGw: 6, planFromGw: 7, startedGw: 1, bank: 1, importedAt: 1_000 });
  });

  it("derives purchase prices, skipping Free Hit transfers", () => {
    expect(team.prices[569].purchase).toBe(60); // bought GW6
    expect(team.prices[8].purchase).toBe(56); // bought on the GW3 wildcard
    expect(team.prices[165].purchase).toBe(75); // held since the initial squad
  });

  it("derives selling prices: half the rise, rounded down; falls in full", () => {
    expect(team.prices[8].selling).toBe(57); // 5.6 → 5.9
    expect(team.prices[124].selling).toBe(57); // 5.5 → 6.0
    expect(team.prices[165].selling).toBe(76); // 7.5 → 7.8
    expect(team.prices[368].selling).toBe(69); // 7.0 → 6.9
  });

  it("replays free transfers through chip weeks", () => {
    // GW2 1 → (BB, none used) GW3 2 → (WC: kept) GW4 2 → GW5 3 → (FH: kept) GW6 3 → 1 used → GW7 3
    expect(team.freeTransfers).toBe(3);
  });

  it("lists chips used and history", () => {
    expect(team.chipsUsed).toEqual([
      { name: "bboost", gw: 2 },
      { name: "wildcard", gw: 3 },
      { name: "freehit", gw: 5 },
    ]);
    expect(team.history).toHaveLength(6);
    expect(team.history[5]).toMatchObject({ gw: 6, transfers: 1, cost: 0, bank: 1 });
  });
});

describe("free hit revert", () => {
  it("plans from the squad before a Free Hit played in the current gameweek", () => {
    const fhPicks: FplPicks = {
      ...input.picks,
      active_chip: "freehit",
      picks: input.picks.picks.slice().reverse(),
    };
    const prePicks: FplPicks = { ...input.picks, entry_history: { ...input.picks.entry_history, bank: 7 } };
    const team = buildTeamImport({ ...input, picks: fhPicks, prePicks }, rules);
    expect(team.slots[0]).toBe(82);
    expect(team.bank).toBe(7);
  });
});

describe("errors and edge cases", () => {
  it("rejects a team that hasn't played yet", () => {
    const entry = { ...input.entry, current_event: null };
    expect(() => buildTeamImport({ ...input, entry }, rules)).toThrow(TeamImportError);
  });

  it("keeps one free transfer after a Wildcard played with one (not two)", () => {
    // Joined GW5 (no transfers before the first deadline) → GW6: 1 → Wildcard in GW6 → GW7: 1.
    const history: FplHistory = {
      chips: [{ name: "wildcard", event: 6 }],
      current: [5, 6].map((event) => ({
        event,
        points: 50,
        total_points: 50,
        bank: 0,
        value: 1000,
        event_transfers: 0,
        event_transfers_cost: 0,
      })),
    };
    expect(deriveFreeTransfers({ ...input.entry, started_event: 5 }, history, 7, rules)).toBe(1);
    // Same with two saved: still two.
    const twoSaved: FplHistory = {
      chips: [{ name: "wildcard", event: 7 }],
      current: [5, 6, 7].map((event) => ({
        event,
        points: 50,
        total_points: 50,
        bank: 0,
        value: 1000,
        event_transfers: 0,
        event_transfers_cost: 0,
      })),
    };
    expect(deriveFreeTransfers({ ...input.entry, started_event: 5 }, twoSaved, 8, rules)).toBe(2);
  });

  it("charges FTs for hits and resets to one", () => {
    const history: FplHistory = {
      chips: [],
      current: [1, 2, 3].map((event) => ({
        event,
        points: 50,
        total_points: 50 * event,
        bank: 0,
        value: 1000,
        event_transfers: event === 3 ? 3 : 0,
        event_transfers_cost: event === 3 ? 4 : 0,
      })),
    };
    const entry = { ...input.entry, started_event: 1 };
    // GW2: 1 → GW3: 2, spends 3 (one hit) → GW4: 1
    expect(deriveFreeTransfers(entry, history, 4, rules)).toBe(1);
    // A late starter gets no transfers before their first deadline.
    expect(deriveFreeTransfers({ ...entry, started_event: 3 }, history, 4, rules)).toBe(1);
  });
});
