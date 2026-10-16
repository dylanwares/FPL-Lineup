import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Plan } from "@/engine/types";
import type { TeamImport } from "@/lib/fpl/types";
import type { BootstrapFile } from "./format";

interface LineupDB extends DBSchema {
  bootstrap: {
    key: "current";
    value: { hash: string; file: BootstrapFile; savedAt: number };
  };
  /** The last import per FPL team, keyed by entry id. */
  teams: {
    key: number;
    value: TeamImport;
  };
  plans: {
    key: string;
    value: Plan;
    indexes: { "by-entry": number };
  };
  /** Sync bookkeeping per plan id (kept apart so in-memory plans can't overwrite it). */
  planSync: {
    key: string;
    value: PlanSync;
  };
}

/**
 * Where a plan stands with the server. A plan with no record has never been
 * synced and counts as an unsynced local edit.
 */
export interface PlanSync {
  id: string;
  /** The account it was last synced to, or null if never. */
  owner: string | null;
  /** The server's version when last synced, or null if the server has never seen it. */
  version: number | null;
  /** Edited (or deleted) here since the last sync. */
  dirty: boolean;
  /** Deleted here; the server still has to hear about it. */
  deleted: boolean;
  /** Bumped by every local edit, so a sync can tell whether one happened while it was uploading. */
  rev: number;
}

const DB_NAME = "fpl-lineup";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<LineupDB>> | null = null;

/** Shared device database. New stores are added with a version bump in upgrade(). */
export function getDb(): Promise<IDBPDatabase<LineupDB>> {
  dbPromise ??= openDB<LineupDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore("bootstrap");
      if (oldVersion < 2) {
        db.createObjectStore("teams");
        db.createObjectStore("plans", { keyPath: "id" }).createIndex("by-entry", "entryId");
      }
      if (oldVersion < 3) db.createObjectStore("planSync", { keyPath: "id" });
    },
    // A newer version of the app (another tab, or the installed app) needs to upgrade the
    // database: step aside and reload into the new version, rather than leave it waiting.
    blocking() {
      void dbPromise?.then((db) => db.close());
      dbPromise = null;
      location.reload();
    },
    blocked() {
      console.warn("Waiting for other FPL Lineup tabs to close before updating saved data");
    },
  }).catch((err: unknown) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

export async function readCachedBootstrap() {
  return (await getDb()).get("bootstrap", "current");
}

export async function writeCachedBootstrap(hash: string, file: BootstrapFile) {
  await (await getDb()).put("bootstrap", { hash, file, savedAt: Date.now() }, "current");
}

export async function readTeam(entryId: number) {
  return (await getDb()).get("teams", entryId);
}

export async function writeTeam(team: TeamImport) {
  await (await getDb()).put("teams", team, team.entryId);
}

export async function readPlans(entryId: number) {
  return (await getDb()).getAllFromIndex("plans", "by-entry", entryId);
}

/**
 * Saves a plan. An `edit` (the user's own change) marks it for upload; a
 * derived rewrite (re-fitting plans to a refreshed FPL squad, which every
 * device does for itself) doesn't.
 */
export async function writePlan(plan: Plan, { edit = true } = {}) {
  const tx = (await getDb()).transaction(["plans", "planSync"], "readwrite");
  void tx.objectStore("plans").put(plan);
  if (edit) {
    const sync = tx.objectStore("planSync");
    const rec = await sync.get(plan.id);
    void sync.put({
      id: plan.id,
      owner: rec?.owner ?? null,
      version: rec?.version ?? null,
      dirty: true,
      deleted: false,
      rev: (rec?.rev ?? 0) + 1,
    });
  }
  await tx.done;
}

/** Deletes a plan here; a synced one is remembered until the server has been told. */
export async function deletePlan(id: string) {
  const tx = (await getDb()).transaction(["plans", "planSync"], "readwrite");
  void tx.objectStore("plans").delete(id);
  const sync = tx.objectStore("planSync");
  const rec = await sync.get(id);
  if (rec?.version != null) void sync.put({ ...rec, dirty: true, deleted: true, rev: rec.rev + 1 });
  else if (rec) void sync.delete(id);
  await tx.done;
}

/** Test helper. */
export function resetDbConnection() {
  dbPromise = null;
}
