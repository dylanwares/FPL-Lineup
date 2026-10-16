import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./db/types";
import { testDb } from "./db/test-db";

// The routes, end to end against PGlite, with Neon Auth's session stubbed.
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
const session = vi.hoisted(() => ({ userId: null as string | null, db: null as unknown }));
vi.mock("@/server/auth", () => ({ currentUserId: async () => session.userId }));
vi.mock("@/server/db", () => ({ getDb: () => session.db }));

const { GET } = await import("@/app/api/plans/route");
const planRoute = await import("@/app/api/plans/[id]/route");
const teamsRoute = await import("@/app/api/teams/route");
const teamRoute = await import("@/app/api/teams/[entryId]/route");

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
  session.db = db;
});
afterAll(() => close());
beforeEach(async () => {
  await db.execute(sql`truncate plans, saved_teams`);
  session.userId = "9d2f7a10-1b3c-4d5e-8f90-a1b2c3d4e5f6";
});

const ID = "6f1c2a9e-4b7d-4c1a-9f3e-2d5b8a7c6e10";
const plan = (name = "Main plan") => ({
  id: ID,
  entryId: 1,
  name,
  base: {
    gw: 7,
    slots: Array.from({ length: 15 }, (_, i) => i + 1),
    captain: 9,
    vice: 8,
    bank: 0,
    freeTransfers: 1,
    purchase: {},
    chipsUsed: [],
  },
  moves: [],
  createdAt: 1,
  updatedAt: 1,
});
const params = <T>(p: T) => ({ params: Promise.resolve(p) });
const put = (body: unknown) =>
  planRoute.PUT(
    new Request(`http://x/api/plans/${ID}`, { method: "PUT", body: JSON.stringify(body) }),
    params({ id: ID }),
  );

describe("/api/plans", () => {
  it("needs a signed-in user", async () => {
    session.userId = null;
    expect((await GET(new Request("http://x/api/plans"))).status).toBe(401);
    expect((await put({ plan: plan(), baseVersion: null })).status).toBe(401);
  });

  it("creates, updates, refuses a stale save with the current plan, and lists", async () => {
    expect(await (await put({ plan: plan(), baseVersion: null })).json()).toMatchObject({
      plan: { version: 1 },
    });
    expect((await put({ plan: plan("Phone"), baseVersion: 1 })).status).toBe(200);
    const stale = await put({ plan: plan("Laptop"), baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ current: { name: "Phone", version: 2 } });
    const list = await (await GET(new Request("http://x/api/plans"))).json();
    expect(list.plans.map((p: { name: string }) => p.name)).toEqual(["Phone"]);
  });

  it("rejects malformed plans with a 400", async () => {
    expect((await put({ plan: { ...plan(), moves: "nope" }, baseVersion: null })).status).toBe(400);
    const bad = await planRoute.PUT(
      new Request(`http://x/api/plans/${ID}`, { method: "PUT", body: "{" }),
      params({ id: ID }),
    );
    expect(bad.status).toBe(400);
  });

  it("deletes at the right version, leaving a tombstone for incremental sync", async () => {
    await put({ plan: plan(), baseVersion: null });
    const del = (v: number) =>
      planRoute.DELETE(
        new Request(`http://x/api/plans/${ID}?version=${v}`, { method: "DELETE" }),
        params({ id: ID }),
      );
    expect((await del(2)).status).toBe(409);
    expect((await del(1)).status).toBe(200);
    expect((await (await GET(new Request("http://x/api/plans"))).json()).plans).toEqual([]);
    const since = await (await GET(new Request("http://x/api/plans?since=0"))).json();
    expect(since.plans[0]).toMatchObject({ id: ID, deletedAt: expect.any(Number) });
  });
});

describe("/api/teams", () => {
  it("links and lists teams", async () => {
    const res = await teamRoute.PUT(
      new Request("http://x/api/teams/42", { method: "PUT", body: JSON.stringify({ label: "Test XI" }) }),
      params({ entryId: "42" }),
    );
    expect(res.status).toBe(200);
    expect(await (await teamsRoute.GET()).json()).toEqual({ teams: [{ entryId: 42, label: "Test XI" }] });
  });
});
