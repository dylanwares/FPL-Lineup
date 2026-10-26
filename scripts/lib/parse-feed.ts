import { XMLParser } from "fast-xml-parser";

/** One item from an RSS or Atom feed, cleaned up for the Content tab. */
export interface FeedItem {
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date;
}

const SUMMARY_MAX = 280;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Keep every value a string ("2026" stays a title, not a number)…
  parseTagValue: false,
  parseAttributeValue: false,
  // …and decode entities ourselves, once, after stripping any HTML.
  processEntities: false,
  isArray: (name) =>
    ["item", "entry", "link", "enclosure", "media:content", "media:thumbnail"].includes(name),
});

type Node = Record<string, unknown>;

/**
 * The items in an RSS 2.0 or Atom feed (YouTube's channel feeds are Atom).
 * Items without a link, title or date are dropped, as are YouTube Shorts.
 * Throws if the XML isn't a feed.
 */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Node;
  const feed = doc.feed as Node | undefined;
  const channel = (doc.rss as Node | undefined)?.channel as Node | undefined;
  let items: (FeedItem | null)[];
  if (feed) items = list(feed.entry).map(atomEntry);
  else if (channel) items = list(channel.item).map(rssItem);
  else throw new Error("Not an RSS or Atom feed.");
  return items.filter((i): i is FeedItem => i !== null && !i.url.includes("youtube.com/shorts/"));
}

function atomEntry(entry: Node): FeedItem | null {
  const links = list(entry.link);
  const link = links.find((l) => attr(l, "rel") === "alternate") ?? links.find((l) => !attr(l, "rel"));
  const group = entry["media:group"] as Node | undefined;
  return item({
    url: attr(link, "href"),
    title: text(entry.title),
    summary: text(entry.summary) ?? text(entry.content),
    imageUrl: attr(list(group?.["media:thumbnail"] ?? entry["media:thumbnail"])[0], "url"),
    published: text(entry.published) ?? text(entry.updated),
  });
}

function rssItem(entry: Node): FeedItem | null {
  const guid = entry.guid;
  const permalink = guid && attr(guid, "isPermaLink") !== "false" ? text(guid) : null;
  const html = text(entry["content:encoded"]) ?? text(entry.description);
  return item({
    url: text(list(entry.link)[0]) ?? permalink,
    title: text(entry.title),
    summary: text(entry.description) ?? text(entry["content:encoded"]),
    imageUrl:
      attr(
        list(entry.enclosure).find((e) => attr(e, "type")?.startsWith("image/")),
        "url",
      ) ??
      attr(
        list(entry["media:content"]).find(
          (m) => attr(m, "medium") === "image" || attr(m, "type")?.startsWith("image/"),
        ),
        "url",
      ) ??
      attr(list(entry["media:thumbnail"])[0], "url") ??
      firstImage(html),
    published: text(entry.pubDate) ?? text(entry["dc:date"]),
  });
}

function item(raw: {
  url: string | null;
  title: string | null;
  summary: string | null;
  imageUrl: string | null;
  published: string | null;
}): FeedItem | null {
  const url = httpUrl(raw.url);
  const title = raw.title && plainText(raw.title);
  const publishedAt = new Date(raw.published ?? "");
  if (!url || !title || Number.isNaN(publishedAt.getTime())) return null;
  return {
    url,
    title,
    summary: raw.summary ? summarise(raw.summary) : null,
    imageUrl: httpUrl(raw.imageUrl && decodeEntities(raw.imageUrl)),
    publishedAt,
  };
}

/** The page's og:image (for articles whose feed has no picture), or null. */
export function ogImage(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bproperty\s*=\s*["']og:image["']/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (content) return httpUrl(decodeEntities(content));
  }
  return null;
}

/** A plain-text teaser: tags and WordPress's "The post … appeared first on …" line removed. */
function summarise(html: string): string | null {
  const body = html.replace(/<p>\s*The post\b[\s\S]*?appeared first on[\s\S]*?<\/p>/i, "");
  const plain = plainText(body);
  if (!plain) return null;
  if (plain.length <= SUMMARY_MAX) return plain;
  const cut = plain.slice(0, SUMMARY_MAX);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 200 ? cut.lastIndexOf(" ") : SUMMARY_MAX).trimEnd()}…`;
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(html: string | null): string | null {
  const src = html && /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  return src ? decodeEntities(src) : null;
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return NAMED[code.toLowerCase()] ?? whole;
    const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

/** Only http(s) links reach the page: never javascript: or data: URLs. */
function httpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function list(v: unknown): Node[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as Node[];
}

/** A node's text, whether it parsed as a string or as an object with attributes. */
function text(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object" && "#text" in v) return text((v as Node)["#text"]);
  return null;
}

function attr(node: unknown, name: string): string | null {
  if (!node || typeof node !== "object") return null;
  const v = (node as Node)[`@${name}`];
  return typeof v === "string" ? v : null;
}
