export const CONTENT_KINDS = ["article", "video"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export const isContentKind = (v: unknown): v is ContentKind => CONTENT_KINDS.includes(v as ContentKind);

/** One article or video, as GET /api/content sends it. */
export interface ContentEntry {
  id: string;
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

export interface ContentPage {
  items: ContentEntry[];
  /** Pass as `before` for the next (older) page; null at the end. */
  nextCursor: string | null;
}
