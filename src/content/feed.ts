import type { ContentEntry, ContentKind, ContentPage } from "./model";

export type ContentFilter = "all" | ContentKind;

export const FILTERS: [ContentFilter, string][] = [
  ["all", "All"],
  ["article", "Articles"],
  ["video", "Videos"],
];

export function contentUrl(filter: ContentFilter, before?: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("kind", filter);
  if (before) params.set("before", before);
  const query = params.toString();
  return query ? `/api/content?${query}` : "/api/content";
}

export async function fetchContent(filter: ContentFilter, before?: string): Promise<ContentPage> {
  const res = await fetch(contentUrl(filter, before));
  if (!res.ok) throw new Error(`Content feed failed with ${res.status}`);
  return (await res.json()) as ContentPage;
}

/** Appends an older page, skipping anything already shown (the feed may have moved on). */
export function appendPage(items: ContentEntry[], page: ContentEntry[]): ContentEntry[] {
  const seen = new Set(items.map((i) => i.id));
  return [...items, ...page.filter((i) => !seen.has(i.id))];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Just now", "12m", "5h", "3d", then the date ("12 Oct"). */
export function timeAgo(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  if (ms < MINUTE) return "Just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
