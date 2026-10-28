import { fetchText } from "@/lib/fetch-json";
import type { ContentEntry } from "./model";
import { ogImage, parseFeed } from "./parse-feed";
import { CONTENT_SOURCES, type ContentSource } from "./sources";

const DAY_MS = 86_400_000;
/** Older items are left out: the tab is for what's current. */
const MAX_AGE_DAYS = 30;
// Users may be waiting on a cold cache, so a slow source is skipped rather than waited for.
const FEED_OPTS = {
  retries: 0,
  timeoutMs: 4_000,
  headers: { accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8" },
};
const PAGE_OPTS = { retries: 0, timeoutMs: 4_000, headers: { accept: "text/html" } };

export interface LoadContentOptions {
  sources?: ContentSource[];
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  now?: number;
}

/**
 * Every source's latest items, merged newest first. A source that fails or
 * is slow is left out (and logged), so one bad feed never empties the tab.
 * Articles whose feed has no picture get their page's og:image.
 */
export async function loadContent({
  sources = CONTENT_SOURCES,
  fetchImpl,
  now = Date.now(),
}: LoadContentOptions = {}): Promise<ContentEntry[]> {
  const oldest = now - MAX_AGE_DAYS * DAY_MS;
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const xml = await fetchText(source.feedUrl, { ...FEED_OPTS, fetchImpl });
      return parseFeed(xml)
        .filter((i) => i.publishedAt.getTime() >= oldest && i.publishedAt.getTime() <= now + DAY_MS)
        .map((i): ContentEntry => ({
          ...i,
          kind: source.kind,
          source: source.name,
          publishedAt: i.publishedAt.toISOString(),
        }));
    }),
  );

  const byUrl = new Map<string, ContentEntry>();
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.warn(`content: ${sources[i].name} failed: ${reason}`);
      return;
    }
    for (const item of r.value) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  });
  const items = [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  await Promise.all(
    items
      .filter((i) => i.kind === "article" && !i.imageUrl)
      .map(async (item) => {
        const html = await fetchText(item.url, { ...PAGE_OPTS, fetchImpl }).catch(() => null);
        item.imageUrl = html ? ogImage(html) : null;
      }),
  );
  return items;
}
