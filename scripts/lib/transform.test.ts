import { describe, expect, it } from "vitest";
import { KITS } from "../../src/config/kits";
import { getRules } from "../../src/config/rules";
import { decodeBootstrap } from "../../src/data/decode";
import { fixturesFor, xpFor } from "../../src/data/model";
import type { SourceData } from "./sources";
import { buildBootstrap, checkChips } from "./transform";

const rules = getRules();

function source(overrides: Partial<SourceData> = {}): SourceData {
  return {
    events: Array.from({ length: 38 }, (_, i) => ({
      gw: i + 1,
      deadline: 1_790_000_000 + i * 604_800,
      finished: i < 5,
      isCurrent: i === 5,
      isNext: i === 6,
    })),
    teams: [
      { id: 1, code: 3, name: "Arsenal", short: "ARS" },
      { id: 2, code: 43, name: "Man City", short: "MCI" },
      { id: 3, code: 14, name: "Liverpool", short: "LIV" },
    ],
    players: [
      {
        id: 20,
        code: 2020,
        name: "Haaland",
        team: 2,
        pos: 4,
        price: 156,
        status: "a",
        chance: null,
        news: "",
        form: 7.3,
        selectedBy: 74.9,
        totalPoints: 60,
        epNext: 6.5,
        stats: { minutes: 540, goals: 8, xg: 6.234, ict: 45.6, penOrder: 1, fkOrder: null },
      },
      {
        id: 10,
        code: 1010,
        name: "Raya",
        team: 1,
        pos: 1,
        price: 61,
        status: "d",
        chance: 75,
        news: "Knock",
        form: 6,
        selectedBy: 30.2,
        totalPoints: 40,
        epNext: 4.2,
      },
    ],
    fixtures: [
      // GW7: ARS v MCI and a double for MCI; LIV blank.
      {
        id: 2,
        gw: 7,
        home: 2,
        away: 3,
        homeDifficulty: 3,
        awayDifficulty: 4,
        kickoff: 1_790_700_000,
        finished: false,
        homeScore: null,
        awayScore: null,
      },
      {
        id: 1,
        gw: 7,
        home: 1,
        away: 2,
        homeDifficulty: 4,
        awayDifficulty: 4,
        kickoff: 1_790_600_000,
        finished: false,
        homeScore: null,
        awayScore: null,
      },
      {
        id: 3,
        gw: null,
        home: 3,
        away: 1,
        homeDifficulty: 4,
        awayDifficulty: 4,
        kickoff: null,
        finished: false,
        homeScore: null,
        awayScore: null,
      },
    ],
    chips: rules.chips.map((c) => ({ name: c.name, ...c.window })),
    ...overrides,
  };
}

const xp = new Map([[20, Array.from({ length: 38 }, (_, i) => (i === 6 ? 7.19 : 5))]]);

describe("buildBootstrap", () => {
  it("round-trips through decode", () => {
    const { file, warnings } = buildBootstrap(source(), xp, rules, (c) => KITS[c], 1_791_000_000);
    expect(warnings).toEqual(["1 players have no projections; using FPL ep_next for the next gameweek"]);

    const data = decodeBootstrap(JSON.parse(JSON.stringify(file)));
    expect(data.currentGw).toBe(6);
    expect(data.nextGw).toBe(7);
    expect(data.events).toHaveLength(38);
    expect(data.events[0]).toEqual({ gw: 1, deadline: 1_790_000_000_000, finished: true });

    // Players are sorted by id.
    expect(data.players.map((p) => p.name)).toEqual(["Raya", "Haaland"]);
    const raya = data.playerById.get(10)!;
    expect(raya).toMatchObject({ pos: "GKP", price: 61, status: "d", chance: 75, form: 6, selectedBy: 30.2 });
    const haaland = data.playerById.get(20)!;
    expect(haaland).toMatchObject({ pos: "FWD", chance: null, form: 7.3 });
    // Stats are scaled on the wire; missing and null ones come back as 0.
    expect(haaland.stats).toMatchObject({
      minutes: 540,
      goals: 8,
      xg: 6.23,
      ict: 45.6,
      penOrder: 1,
      fkOrder: 0,
      saves: 0,
    });
    expect(raya.stats.minutes).toBe(0);

    expect(data.teamById.get(2)!.kit).toEqual({
      style: KITS[43].style,
      primary: KITS[43].primary,
      secondary: KITS[43].secondary,
      gk: KITS[43].gk,
    });

    // Doubles are ordered by kickoff; blanks are empty; unscheduled go in bucket 0.
    expect(fixturesFor(data, 2, 7).map((f) => f.id)).toEqual([1, 2]);
    expect(fixturesFor(data, 3, 7).map((f) => f.id)).toEqual([2]);
    expect(fixturesFor(data, 3, 8)).toEqual([]);
    expect(data.fixturesByGw[0].map((f) => f.id)).toEqual([3]);

    // Projections, with ep_next fallback for the next GW only.
    expect(xpFor(data, haaland, 7)).toBe(7.19);
    expect(xpFor(data, haaland, 8)).toBe(5);
    expect(xpFor(data, raya, 7)).toBe(4.2);
    expect(xpFor(data, raya, 8)).toBeNull();
    expect(xpFor(data, raya, 39)).toBeNull();
  });

  it("warns when projections are missing entirely or a kit is unknown", () => {
    const src = source({ teams: [{ id: 1, code: 999, name: "Newco", short: "NEW" }] });
    const { file, warnings } = buildBootstrap(src, null, rules, (c) => KITS[c], 0);
    expect(warnings).toContain("No kit configured for Newco (code 999)");
    expect(warnings).toContain("No projections loaded; using FPL ep_next for the next gameweek only");
    expect(file.teams.kit[0][0]).toBe("plain");
  });
});

describe("checkChips", () => {
  it("passes when windows match the config", () => {
    expect(checkChips(source().chips, rules)).toEqual([]);
  });

  it("reports drift", () => {
    const chips = source().chips.filter((c) => c.name !== "3xc");
    expect(checkChips(chips, rules)[0]).toMatch(/Chip windows differ/);
  });
});
