import type { ContentKind } from "./model";

/*
 * Where the Content tab's articles and videos come from: each source's
 * RSS/Atom feed, polled every 15 minutes by scripts/fetch-content.ts.
 * YouTube channels publish one at /feeds/videos.xml (no API key needed).
 * To add a source, add a line here; `id` is stored on each row, so keep it
 * stable once a source has items.
 */

export interface ContentSource {
  id: string;
  name: string;
  kind: ContentKind;
  feedUrl: string;
}

const youtube = (id: string, name: string, channelId: string): ContentSource => ({
  id,
  name,
  kind: "video",
  feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
});

export const CONTENT_SOURCES: ContentSource[] = [
  {
    id: "ffscout",
    name: "Fantasy Football Scout",
    kind: "article",
    feedUrl: "https://www.fantasyfootballscout.co.uk/feed",
  },
  { id: "allaboutfpl", name: "AllAboutFPL", kind: "article", feedUrl: "https://allaboutfpl.com/feed" },
  youtube("letstalkfpl", "Let's Talk FPL", "UCxeOc7eFxq37yW_Nc-69deA"),
  youtube("fplharry", "FPL Harry", "UCcPWnCj5AKC19HaySZjb25g"),
  youtube("fplmate", "FPL Mate", "UCweDAlFm2LnVcOqaFU4_AGA"),
  youtube("fplfocal", "FPL Focal", "UC72QokPHXQ9r98ROfNZmaDw"),
  youtube("fplraptor", "FPL Raptor", "UC54QLWzsMifTRjNQ02z5pCw"),
  youtube("fplblackbox", "FPL BlackBox", "UCGJ8-xqhOLwyJNuPMsVoQWQ"),
  youtube("fplgeneral", "FPL General", "UCxj4WVoWBuwXPGJsvUFPVig"),
  youtube("ffhub", "Fantasy Football Hub", "UCcqEr3DfrRwtoF2a1yW8qgQ"),
  youtube("fpltips", "FPLtips", "UCVPb_jLxwaoYd-Dm7aSWQKQ"),
  youtube("fplfamily", "FPL Family", "UCDG_EqOaaO1SSxEMZwfrSkg"),
];

const NAMES = new Map(CONTENT_SOURCES.map((s) => [s.id, s.name]));

/** A source's display name (or its id, for rows from a source since removed). */
export const sourceName = (id: string) => NAMES.get(id) ?? id;
