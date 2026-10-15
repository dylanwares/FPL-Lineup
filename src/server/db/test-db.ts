import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Db } from "./types";

/**
 * A fresh in-process Postgres (PGlite) with every migration applied: the same
 * SQL production runs, with no server or Docker needed. For tests only.
 */
export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../../drizzle") });
  return { db, close: () => client.close() };
}

/** A user id as Neon Auth would issue it (users themselves live in Neon, not here). */
export function testUser(): string {
  return crypto.randomUUID();
}
