import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "./types";
import * as schema from "./schema";

/*
 * The database, from DATABASE_URL. Neon (production) is reached over its
 * serverless driver, which suits short-lived functions; anything else (the
 * local Docker Postgres) over a plain TCP connection. Tests don't come
 * through here: they hand an in-process PGlite to the data functions.
 */

const cache = globalThis as typeof globalThis & { lineupDb?: Db };

export function getDb(): Db {
  // Kept on globalThis so dev-server reloads reuse the pool instead of opening new ones.
  return (cache.lineupDb ??= connect());
}

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  if (new URL(url).hostname.endsWith(".neon.tech")) {
    return drizzleNeon({ client: new Pool({ connectionString: url }), schema });
  }
  return drizzlePostgres({ client: postgres(url, { max: 5 }), schema });
}
