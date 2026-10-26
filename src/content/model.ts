export const CONTENT_KINDS = ["article", "video"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

/** One article or video, as GET /api/content sends it. The URL identifies it. */
export interface ContentEntry {
  kind: ContentKind;
  /** The source's display name. */
  source: string;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  /** ISO 8601. */
  publishedAt: string;
}

/** GET /api/content: every source's latest items, newest first. */
export interface ContentFeed {
  items: ContentEntry[];
}
