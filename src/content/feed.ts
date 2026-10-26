import type { ContentEntry, ContentFeed, ContentKind } from "./model";

export type ContentFilter = "all" | ContentKind;

export const FILTERS: [ContentFilter, string][] = [
  ["all", "All"],
  ["article", "Articles"],
  ["video", "Videos"],
];

export async function fetchContent(): Promise<ContentEntry[]> {
  const res = await fetch("/api/content");
  if (!res.ok) throw new Error(`Content feed failed with ${res.status}`);
  return ((await res.json()) as ContentFeed).items;
}

export const filterContent = (items: ContentEntry[], filter: ContentFilter) =>
  filter === "all" ? items : items.filter((i) => i.kind === filter);

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
