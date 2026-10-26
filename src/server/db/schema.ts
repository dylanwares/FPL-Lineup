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
import type { ContentKind } from "@/content/model";
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

/**
 * Articles and videos for the Content tab, pulled from each source's feed by
 * scripts/fetch-content.ts. Shared by everyone, so no user id. The URL is
 * the dedupe key: a feed lists the same items run after run.
 */
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** A source id from src/content/sources.ts. */
    source: text("source").notNull(),
    kind: text("kind").$type<ContentKind>().notNull(),
    url: text("url").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // The feed pages newest first, by (published_at, id).
    index("content_items_published_idx").on(t.publishedAt.desc(), t.id.desc()),
    index("content_items_kind_published_idx").on(t.kind, t.publishedAt.desc(), t.id.desc()),
    check("content_items_kind", sql`${t.kind} in ('article', 'video')`),
  ],
);
