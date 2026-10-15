import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any of our Postgres connections (Neon, postgres.js, or PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
