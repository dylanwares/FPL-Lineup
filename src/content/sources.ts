import type { ContentKind } from "./model";

/*
 * Where the Content tab's articles and videos come from: each source's
 * RSS/Atom feed, read live by GET /api/content (cached for a few minutes).
 * YouTube channels publish one at /feeds/videos.xml (no API key needed).
 * To add a source, add a line here.
 */

export interface ContentSource {
  name: string;
  kind: ContentKind;
  feedUrl: string;
}

const youtube = (name: string, channelId: string): ContentSource => ({
  name,
  kind: "video",
  feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
});

export const CONTENT_SOURCES: ContentSource[] = [
  {
    name: "Fantasy Football Scout",
    kind: "article",
    feedUrl: "https://www.fantasyfootballscout.co.uk/feed",
  },
  { name: "AllAboutFPL", kind: "article", feedUrl: "https://allaboutfpl.com/feed" },
  youtube("Let's Talk FPL", "UCxeOc7eFxq37yW_Nc-69deA"),
  youtube("FPL Harry", "UCcPWnCj5AKC19HaySZjb25g"),
  youtube("FPL Mate", "UCweDAlFm2LnVcOqaFU4_AGA"),
  youtube("FPL Focal", "UC72QokPHXQ9r98ROfNZmaDw"),
  youtube("FPL Raptor", "UC54QLWzsMifTRjNQ02z5pCw"),
  youtube("FPL BlackBox", "UCGJ8-xqhOLwyJNuPMsVoQWQ"),
  youtube("FPL General", "UCxj4WVoWBuwXPGJsvUFPVig"),
  youtube("Fantasy Football Hub", "UCcqEr3DfrRwtoF2a1yW8qgQ"),
  youtube("FPLtips", "UCVPb_jLxwaoYd-Dm7aSWQKQ"),
  youtube("FPL Family", "UCDG_EqOaaO1SSxEMZwfrSkg"),
];
