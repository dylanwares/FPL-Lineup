import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { ContentKind } from "@/content/model";
import { contentItems } from "./schema";
import type { Db } from "./types";

export interface ContentItem {
  id: string;
  source: string;
  kind: ContentKind;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date;
}

export type NewContentItem = Omit<ContentItem, "id">;

/** Where a page of the feed ends: the last item's (publishedAt, id). */
export interface ContentCursor {
  publishedAt: Date;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const encodeCursor = (c: ContentCursor) => `${c.publishedAt.toISOString()}_${c.id}`;

/** The cursor from a query string, or null if it isn't one. */
export function decodeCursor(raw: string): ContentCursor | null {
  const [iso, id, ...rest] = raw.split("_");
  const publishedAt = new Date(iso);
  if (rest.length || !id || !UUID.test(id) || Number.isNaN(publishedAt.getTime())) return null;
  return { publishedAt, id };
}

/**
 * Adds new items and refreshes known ones (titles get edited). An item keeps
 * its first publish date, and its image if the feed later drops it.
 * Returns how many were new. `items` must not repeat a URL.
 */
export async function upsertContent(db: Db, items: NewContentItem[]): Promise<number> {
  if (!items.length) return 0;
  const rows = await db
    .insert(contentItems)
    .values(items)
    .onConflictDoUpdate({
      target: contentItems.url,
      set: {
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        imageUrl: sql`coalesce(excluded.image_url, ${contentItems.imageUrl})`,
      },
    })
    // xmax is 0 for a freshly inserted row, and set for an updated one.
    .returning({ inserted: sql<boolean>`xmax = 0` });
  return rows.filter((r) => r.inserted).length;
}

/** Which of these URLs are already stored. */
export async function existingContentUrls(db: Db, urls: string[]): Promise<Set<string>> {
  if (!urls.length) return new Set();
  const rows = await db
    .select({ url: contentItems.url })
    .from(contentItems)
    .where(inArray(contentItems.url, urls));
  return new Set(rows.map((r) => r.url));
}

/** A page of the feed, newest first, optionally of one kind, older than `before`. */
export async function listContent(
  db: Db,
  { kind, before, limit }: { kind?: ContentKind; before?: ContentCursor; limit: number },
): Promise<{ items: ContentItem[]; nextCursor: string | null }> {
  const { publishedAt, id } = contentItems;
  const rows = await db
    .select({
      id,
      source: contentItems.source,
      kind: contentItems.kind,
      url: contentItems.url,
      title: contentItems.title,
      summary: contentItems.summary,
      imageUrl: contentItems.imageUrl,
      publishedAt,
    })
    .from(contentItems)
    .where(
      and(
        kind ? eq(contentItems.kind, kind) : undefined,
        before
          ? or(
              lt(publishedAt, before.publishedAt),
              and(eq(publishedAt, before.publishedAt), lt(id, before.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(publishedAt), desc(id))
    .limit(limit + 1);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}

/** Deletes items published before `cutoff`, so the table stays small. Returns how many. */
export async function pruneContent(db: Db, cutoff: Date): Promise<number> {
  const rows = await db
    .delete(contentItems)
    .where(lt(contentItems.publishedAt, cutoff))
    .returning({ id: contentItems.id });
  return rows.length;
}
