import { expect, it, vi } from "vitest";
import { loadContent } from "./load";
import type { ContentSource } from "./sources";

const NOW = Date.parse("2026-10-26T12:00:00Z");

const rss = (items: { title: string; link: string; date: string }[]) =>
  `<rss><channel>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.date}</pubDate></item>`)
    .join("")}</channel></rss>`;

const SOURCES: ContentSource[] = [
  { name: "Articles", kind: "article", feedUrl: "https://feeds.test/articles" },
  { name: "Videos", kind: "video", feedUrl: "https://feeds.test/videos" },
  { name: "Down", kind: "article", feedUrl: "https://feeds.test/down" },
];

const PAGES: Record<string, string> = {
  "https://feeds.test/articles": rss([
    { title: "Newest", link: "https://site.test/newest", date: "Mon, 26 Oct 2026 11:00:00 GMT" },
    { title: "Too old", link: "https://site.test/old", date: "Mon, 14 Sep 2026 11:00:00 GMT" },
  ]),
  "https://feeds.test/videos": rss([
    { title: "Video", link: "https://video.test/1", date: "Mon, 26 Oct 2026 09:00:00 GMT" },
    // Listed by both feeds: kept once.
    { title: "Newest", link: "https://site.test/newest", date: "Mon, 26 Oct 2026 11:00:00 GMT" },
  ]),
  "https://site.test/newest": `<meta property="og:image" content="https://site.test/newest.jpg">`,
};

const fetchImpl = vi.fn(async (input: string | URL | Request) => {
  const body = PAGES[String(input)];
  return body ? new Response(body) : new Response("Gone", { status: 404 });
}) as typeof fetch;

it("merges every working source newest first, skipping failures, old and repeated items", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const items = await loadContent({ sources: SOURCES, fetchImpl, now: NOW });

  expect(items).toEqual([
    {
      kind: "article",
      source: "Articles",
      url: "https://site.test/newest",
      title: "Newest",
      summary: null,
      // From the article page, as its feed has no picture.
      imageUrl: "https://site.test/newest.jpg",
      publishedAt: "2026-10-26T11:00:00.000Z",
    },
    {
      kind: "video",
      source: "Videos",
      url: "https://video.test/1",
      title: "Video",
      summary: null,
      imageUrl: null,
      publishedAt: "2026-10-26T09:00:00.000Z",
    },
  ]);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("Down failed"));
  warn.mockRestore();
});
