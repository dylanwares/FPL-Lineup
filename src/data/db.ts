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
}

const DB_NAME = "fpl-lineup";
const DB_VERSION = 2;

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

export async function writePlan(plan: Plan) {
  await (await getDb()).put("plans", plan);
}

/** Test helper. */
export function resetDbConnection() {
  dbPromise = null;
}
