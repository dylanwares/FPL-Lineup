import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Plan } from "@/engine/types";
import { plans, type PlanRow } from "./schema";
import type { Db } from "./types";

/** A plan as stored for a signed-in user: the device's plan plus its sync state. */
export interface StoredPlan extends Plan {
  /** Bumped on every save; a save must name the version it was based on. */
  version: number;
  /** Set when the plan was deleted (kept so other devices hear about it). Epoch ms. */
  deletedAt: number | null;
}

export type SaveResult =
  | { status: "saved"; plan: StoredPlan }
  /** Someone else saved (or deleted) it first: here's what's there now. */
  | { status: "conflict"; current: StoredPlan }
  /** No such plan for this user. */
  | { status: "not-found" };

function toPlan(row: PlanRow): StoredPlan {
  return {
    id: row.id,
    entryId: row.entryId,
    name: row.name,
    base: row.baseSnapshot,
    moves: row.moves,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    version: row.version,
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : null,
  };
}

const owned = (userId: string, id: string) => and(eq(plans.userId, userId), eq(plans.id, id));

/**
 * A user's plans, oldest first. With `since` (epoch ms), everything changed
 * after it, deletions included, for an incremental sync; without, the live
 * plans only.
 */
export async function listPlans(
  db: Db,
  userId: string,
  opts: { entryId?: number; since?: number } = {},
): Promise<StoredPlan[]> {
  const rows = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.userId, userId),
        opts.entryId === undefined ? undefined : eq(plans.entryId, opts.entryId),
        opts.since === undefined ? isNull(plans.deletedAt) : gt(plans.updatedAt, new Date(opts.since)),
      ),
    )
    .orderBy(asc(plans.createdAt));
  return rows.map(toPlan);
}

export async function getPlan(db: Db, userId: string, id: string): Promise<StoredPlan | null> {
  const [row] = await db.select().from(plans).where(owned(userId, id));
  return row ? toPlan(row) : null;
}

/** What happened when a write matched no row: someone moved it on, or it isn't theirs. */
async function missed(db: Db, userId: string, id: string): Promise<SaveResult> {
  const current = await getPlan(db, userId, id);
  return current ? { status: "conflict", current } : { status: "not-found" };
}

/**
 * Saves a plan. `baseVersion` is the version the device last had: null for a
 * plan the server hasn't seen (it's created at version 1). A save based on an
 * older version than the server's is a conflict, and nothing is written.
 */
export async function savePlan(
  db: Db,
  userId: string,
  plan: Plan,
  baseVersion: number | null,
): Promise<SaveResult> {
  const fields = {
    entryId: plan.entryId,
    name: plan.name,
    baseGw: plan.base.gw,
    baseSnapshot: plan.base,
    moves: plan.moves,
  };

  if (baseVersion === null) {
    const [row] = await db
      .insert(plans)
      .values({ id: plan.id, userId, ...fields, createdAt: new Date(plan.createdAt) })
      .onConflictDoNothing()
      .returning();
    return row ? { status: "saved", plan: toPlan(row) } : missed(db, userId, plan.id);
  }

  const [row] = await db
    .update(plans)
    .set({ ...fields, version: sql`${plans.version} + 1`, updatedAt: sql`now()` })
    .where(and(owned(userId, plan.id), eq(plans.version, baseVersion), isNull(plans.deletedAt)))
    .returning();
  return row ? { status: "saved", plan: toPlan(row) } : missed(db, userId, plan.id);
}

/** Deletes a plan, leaving a tombstone. Like a save, it must name the version it's based on. */
export async function deletePlan(
  db: Db,
  userId: string,
  id: string,
  baseVersion: number,
): Promise<SaveResult> {
  const [row] = await db
    .update(plans)
    .set({ deletedAt: sql`now()`, version: sql`${plans.version} + 1`, updatedAt: sql`now()` })
    .where(and(owned(userId, id), eq(plans.version, baseVersion), isNull(plans.deletedAt)))
    .returning();
  return row ? { status: "saved", plan: toPlan(row) } : missed(db, userId, id);
}
