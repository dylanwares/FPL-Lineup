/**
 * Pulls the latest FPL articles and videos from every source in
 * src/content/sources.ts into content_items, and drops items older than
 * KEEP_DAYS. Run every 15 minutes by .github/workflows/content.yml, or by
 * hand with `pnpm content`. Fails only if every source failed.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { CONTENT_SOURCES } from "../src/content/sources";
import { fetchText } from "../src/lib/fetch-json";
import {
  existingContentUrls,
  pruneContent,
  upsertContent,
  type NewContentItem,
} from "../src/server/db/content";
import * as schema from "../src/server/db/schema";
import { ogImage, parseFeed } from "./lib/parse-feed";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not there: fine.
  }
}

const KEEP_DAYS = 60;
const DAY_MS = 86_400_000;
const FEED_HEADERS = {
  accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const now = Date.now();
  const cutoff = new Date(now - KEEP_DAYS * DAY_MS);

  const results = await Promise.allSettled(
    CONTENT_SOURCES.map(async (source) => {
      // The next run is only 15 minutes away, so one retry is plenty.
      const xml = await fetchText(source.feedUrl, { retries: 1, headers: FEED_HEADERS });
      return parseFeed(xml)
        .filter((i) => i.publishedAt >= cutoff && i.publishedAt.getTime() <= now + DAY_MS)
        .map((i): NewContentItem => ({ ...i, source: source.id, kind: source.kind }));
    }),
  );

  const byUrl = new Map<string, NewContentItem>();
  results.forEach((r, i) => {
    const { name } = CONTENT_SOURCES[i];
    if (r.status === "rejected") {
      console.warn(`content: ${name} failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    console.log(`content: ${name}: ${r.value.length} items`);
    for (const item of r.value) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  });
  if (results.every((r) => r.status === "rejected")) throw new Error("Every source failed.");

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle({ client, schema });
    const items = [...byUrl.values()];
    const known = await existingContentUrls(db, [...byUrl.keys()]);
    await addArticleImages(items, known);
    const added = await upsertContent(db, items);
    const pruned = await pruneContent(db, cutoff);
    console.log(`content: ${added} new, ${items.length - added} refreshed, ${pruned} pruned`);
  } finally {
    await client.end();
  }
}

/** Articles whose feed has no picture get the page's og:image, looked up once (when first seen). */
async function addArticleImages(items: NewContentItem[], known: Set<string>) {
  await Promise.all(
    items
      .filter((i) => i.kind === "article" && !i.imageUrl && !known.has(i.url))
      .map(async (item) => {
        const html = await fetchText(item.url, {
          retries: 0,
          timeoutMs: 10_000,
          headers: { accept: "text/html" },
        }).catch(() => null);
        item.imageUrl = html ? ogImage(html) : null;
      }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
