import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Move, Snapshot } from "@/engine/types";

/*
 * FPL Lineup's own tables (players, fixtures and projections come from the
 * bootstrap file, not from here). Only signed-in people have rows: anonymous
 * plans live in IndexedDB on the device.
 *
 * Accounts are Neon Auth's (managed Better Auth): its users and sessions live
 * in the `neon_auth` schema, which Neon manages. Our rows hold the user's id
 * as text, with no foreign key, because that schema doesn't exist in local
 * Docker or the PGlite tests (and isn't ours to migrate). Deleting an account
 * must therefore delete these rows too (see deleteUserData).
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const userId = () => text("user_id").notNull();

/** FPL team IDs linked to an account, so a signed-in user can switch between them. */
export const savedTeams = pgTable(
  "saved_teams",
  {
    userId: userId(),
    entryId: integer("entry_id").notNull(),
    label: text("label").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.entryId] }),
    check("saved_teams_label_length", sql`char_length(${t.label}) between 1 and 60`),
  ],
);

/**
 * A plan: the squad it starts from plus its move log, as on the device.
 * `version` goes up by one on every save, so a save based on an older version
 * is a conflict (another device got there first). Deletes keep the row as a
 * tombstone (`deleted_at`) so other devices learn about them when they sync.
 */
export const plans = pgTable(
  "plans",
  {
    // Made on the device (crypto.randomUUID), so a plan keeps its id when it syncs.
    id: uuid("id").primaryKey(),
    userId: userId(),
    entryId: integer("entry_id").notNull(),
    name: text("name").notNull(),
    baseGw: smallint("base_gw").notNull(),
    baseSnapshot: jsonb("base_snapshot").$type<Snapshot>().notNull(),
    moves: jsonb("moves").$type<Move[]>().notNull(),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    /** When the plan was last edited, on whichever device: for "most recent" ordering. */
    editedAt: timestamp("edited_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the server last wrote the row: incremental sync asks for rows changed after a time. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("plans_user_entry_idx").on(t.userId, t.entryId),
    // Sync asks for "everything changed since…".
    index("plans_user_updated_idx").on(t.userId, t.updatedAt),
    check("plans_name_length", sql`char_length(${t.name}) between 1 and 40`),
    check("plans_version_positive", sql`${t.version} >= 1`),
  ],
);

export type PlanRow = typeof plans.$inferSelect;
