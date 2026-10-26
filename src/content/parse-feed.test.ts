import { describe, expect, it } from "vitest";
import { decodeEntities, ogImage, parseFeed } from "./parse-feed";

// Trimmed from the real feeds (October 2026).
const WORDPRESS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Fantasy Football Scout</title>
  <atom:link href="https://www.fantasyfootballscout.co.uk/feed" rel="self" type="application/rss+xml" />
  <link>https://www.fantasyfootballscout.co.uk/</link>
  <item>
    <title>Top FPL Gameweek 8 Captain Picks Based on Analysis &#038; Metrics</title>
    <link>https://allaboutfpl.com/2026/10/top-fpl-gameweek-8-captain-picks/</link>
    <dc:creator><![CDATA[AK - Anurag Khetan]]></dc:creator>
    <pubDate>Thu, 22 Oct 2026 21:07:52 +0000</pubDate>
    <guid isPermaLink="false">https://allaboutfpl.com/?p=86306</guid>
    <description><![CDATA[<p>FPL Gameweek 8 is around the corner &amp; we look at the picks.</p>
<p>The post <a href="https://allaboutfpl.com/2026/10/top">Top FPL Gameweek 8 Captain Picks</a> appeared first on <a href="https://allaboutfpl.com">ALLABOUTFPL</a>.</p>
]]></description>
    <content:encoded><![CDATA[<p>Welcome</p><figure><img decoding="async" width="612" src="https://cdn.allaboutfpl.com/uploads/metrics.png?a=1&amp;b=2" alt="" /></figure>]]></content:encoded>
  </item>
  <item>
    <title>2026</title>
    <link>javascript:alert(1)</link>
    <pubDate>Thu, 22 Oct 2026 20:00:00 +0000</pubDate>
  </item>
  <item>
    <title>No date</title>
    <link>https://example.com/no-date</link>
  </item>
</channel>
</rss>`;

const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCweDAlFm2LnVcOqaFU4_AGA"/>
 <title>FPL Mate</title>
 <entry>
  <id>yt:video:rmvAa5ZVY2U</id>
  <title>GW8 Is Over... Here's What I'm Doing in GW9!</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=rmvAa5ZVY2U"/>
  <published>2026-10-25T20:10:43+00:00</published>
  <updated>2026-10-26T10:57:14+00:00</updated>
  <media:group>
   <media:title>GW8 Is Over... Here's What I'm Doing in GW9!</media:title>
   <media:thumbnail url="https://i3.ytimg.com/vi/rmvAa5ZVY2U/hqdefault.jpg" width="480" height="360"/>
   <media:description>50% OFF Hub 👉 https://go.example.com</media:description>
  </media:group>
 </entry>
 <entry>
  <title>Short</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/abc123"/>
  <published>2026-10-25T19:00:00+00:00</published>
 </entry>
</feed>`;

describe("parseFeed", () => {
  it("reads a WordPress RSS item, decoding entities and dropping the 'appeared first on' line", () => {
    const [first, ...rest] = parseFeed(WORDPRESS);
    expect(first).toEqual({
      url: "https://allaboutfpl.com/2026/10/top-fpl-gameweek-8-captain-picks/",
      title: "Top FPL Gameweek 8 Captain Picks Based on Analysis & Metrics",
      summary: "FPL Gameweek 8 is around the corner & we look at the picks.",
      imageUrl: "https://cdn.allaboutfpl.com/uploads/metrics.png?a=1&b=2",
      publishedAt: new Date("2026-10-22T21:07:52Z"),
    });
    // The javascript: link and the undated item are dropped.
    expect(rest).toEqual([]);
  });

  it("reads a YouTube channel feed, skipping Shorts", () => {
    expect(parseFeed(YOUTUBE)).toEqual([
      {
        url: "https://www.youtube.com/watch?v=rmvAa5ZVY2U",
        title: "GW8 Is Over... Here's What I'm Doing in GW9!",
        summary: null,
        imageUrl: "https://i3.ytimg.com/vi/rmvAa5ZVY2U/hqdefault.jpg",
        publishedAt: new Date("2026-10-25T20:10:43Z"),
      },
    ]);
  });

  it("prefers an image enclosure and caps long summaries", () => {
    const long = "word ".repeat(100);
    const [item] = parseFeed(`<rss><channel><item>
      <title>T</title><link>https://example.com/a</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/a.jpg" type="image/jpeg" length="1"/>
      <description>${long}</description>
    </item></channel></rss>`);
    expect(item.imageUrl).toBe("https://example.com/a.jpg");
    expect(item.summary!.length).toBeLessThanOrEqual(281);
    expect(item.summary).toMatch(/word…$/);
  });

  it("rejects anything that isn't a feed", () => {
    expect(() => parseFeed("<html><body>Not found</body></html>")).toThrow(/Not an RSS or Atom feed/);
  });
});

describe("ogImage", () => {
  it("finds og:image in either attribute order", () => {
    expect(ogImage(`<meta property="og:image" content="https://example.com/a.jpg?x=1&amp;y=2">`)).toBe(
      "https://example.com/a.jpg?x=1&y=2",
    );
    expect(ogImage(`<meta content='https://example.com/b.png' property='og:image' />`)).toBe(
      "https://example.com/b.png",
    );
    expect(ogImage(`<meta property="og:title" content="Hi">`)).toBeNull();
  });
});

it("decodeEntities handles named, decimal and hex entities", () => {
  expect(decodeEntities("A &amp; B &#8217;s &#x2014; &pound;5 &bogus;")).toBe("A & B ’s — £5 &bogus;");
});
