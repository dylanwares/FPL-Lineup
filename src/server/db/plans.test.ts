import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Plan } from "@/engine/types";
import { deletePlan, getPlan, listPlans, savePlan } from "./plans";
import { removeSavedTeam, listSavedTeams, saveTeam } from "./saved-teams";
import { testDb, testUser } from "./test-db";
import { deleteUserData } from "./users";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
let user: string;

// One database for the file (PGlite takes a moment to start); each test starts empty.
beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());
beforeEach(async () => {
  await db.execute(sql`truncate plans, saved_teams`);
  user = testUser();
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: crypto.randomUUID(),
  entryId: 1,
  name: "Main plan",
  base: {
    gw: 7,
    slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    captain: 9,
    vice: 8,
    bank: 5,
    freeTransfers: 1,
    purchase: { 1: 45 },
    chipsUsed: [{ name: "wildcard", gw: 3 }],
  },
  moves: [{ type: "transfer", gw: 7, out: 9, in: 99 }],
  createdAt: Date.parse("2026-10-01T12:00:00Z"),
  updatedAt: Date.parse("2026-10-01T12:00:00Z"),
  ...over,
});

describe("savePlan", () => {
  it("creates a plan at version 1 and reads it back exactly", async () => {
    const p = plan();
    const saved = await savePlan(db, user, p, null);
    expect(saved).toMatchObject({ status: "saved", plan: { version: 1, deletedAt: null } });
    const read = await getPlan(db, user, p.id);
    expect(read).toMatchObject({
      id: p.id,
      name: p.name,
      base: p.base,
      moves: p.moves,
      createdAt: p.createdAt,
    });
  });

  it("updates from the current version and bumps it", async () => {
    const p = plan();
    await savePlan(db, user, p, null);
    const result = await savePlan(db, user, { ...p, name: "Wildcard draft", moves: [] }, 1);
    expect(result).toMatchObject({
      status: "saved",
      plan: { version: 2, name: "Wildcard draft", moves: [] },
    });
  });

  it("rejects a save based on an old version and returns what's there now", async () => {
    const p = plan();
    await savePlan(db, user, p, null);
    await savePlan(db, user, { ...p, name: "From the phone" }, 1); // now version 2
    const stale = await savePlan(db, user, { ...p, name: "From the laptop" }, 1);
    expect(stale).toMatchObject({ status: "conflict", current: { version: 2, name: "From the phone" } });
    expect((await getPlan(db, user, p.id))?.name).toBe("From the phone");
  });

  it("treats creating an id that already exists as a conflict", async () => {
    const p = plan();
    await savePlan(db, user, p, null);
    expect(await savePlan(db, user, { ...p, name: "Again" }, null)).toMatchObject({
      status: "conflict",
      current: { name: "Main plan" },
    });
  });

  it("never touches another user's plan", async () => {
    const p = plan();
    await savePlan(db, user, p, null);
    const other = testUser();
    expect(await savePlan(db, other, { ...p, name: "Mine now" }, 1)).toEqual({ status: "not-found" });
    expect(await savePlan(db, other, p, null)).toEqual({ status: "not-found" });
    expect(await getPlan(db, other, p.id)).toBeNull();
  });

  it("enforces the 40-character name limit", async () => {
    await expect(savePlan(db, user, plan({ name: "x".repeat(41) }), null)).rejects.toThrow();
  });
});

describe("deletePlan and listPlans", () => {
  it("leaves a tombstone that only an incremental sync returns", async () => {
    const keep = plan({ name: "Keep" });
    const gone = plan({ name: "Gone", createdAt: keep.createdAt + 1 });
    await savePlan(db, user, keep, null);
    await savePlan(db, user, gone, null);
    const before = Date.now() - 1000;

    expect(await deletePlan(db, user, gone.id, 1)).toMatchObject({ status: "saved", plan: { version: 2 } });
    expect((await listPlans(db, user)).map((p) => p.name)).toEqual(["Keep"]);
    const changed = await listPlans(db, user, { since: before });
    expect(changed.find((p) => p.id === gone.id)?.deletedAt).toEqual(expect.any(Number));
  });

  it("won't delete from a stale version, or save over a deleted plan", async () => {
    const p = plan();
    await savePlan(db, user, p, null);
    await savePlan(db, user, p, 1);
    expect(await deletePlan(db, user, p.id, 1)).toMatchObject({ status: "conflict" });
    await deletePlan(db, user, p.id, 2);
    expect(await savePlan(db, user, p, 3)).toMatchObject({
      status: "conflict",
      current: { deletedAt: expect.any(Number) },
    });
  });

  it("filters by FPL team", async () => {
    await savePlan(db, user, plan({ entryId: 1 }), null);
    await savePlan(db, user, plan({ entryId: 2 }), null);
    expect((await listPlans(db, user, { entryId: 2 })).map((p) => p.entryId)).toEqual([2]);
  });
});

describe("saved teams", () => {
  it("links, relabels and unlinks teams", async () => {
    await saveTeam(db, user, { entryId: 1, label: "Main" });
    await saveTeam(db, user, { entryId: 2, label: "Mini-league alt" });
    await saveTeam(db, user, { entryId: 1, label: "Main team" });
    expect(await listSavedTeams(db, user)).toEqual([
      { entryId: 1, label: "Main team" },
      { entryId: 2, label: "Mini-league alt" },
    ]);
    await removeSavedTeam(db, user, 2);
    expect(await listSavedTeams(db, user)).toEqual([{ entryId: 1, label: "Main team" }]);
  });

  it("is all removed with the user's data, and only theirs", async () => {
    const other = testUser();
    await saveTeam(db, user, { entryId: 1, label: "Main" });
    await savePlan(db, user, plan(), null);
    await savePlan(db, other, plan(), null);
    await deleteUserData(db, user);
    expect(await listSavedTeams(db, user)).toEqual([]);
    expect(await listPlans(db, user)).toEqual([]);
    expect(await listPlans(db, other)).toHaveLength(1);
  });
});
