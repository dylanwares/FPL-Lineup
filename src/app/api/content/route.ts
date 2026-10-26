import { isContentKind, type ContentPage } from "@/content/model";
import { sourceName } from "@/content/sources";
import { json } from "@/server/api";
import { getDb } from "@/server/db";
import { decodeCursor, listContent } from "@/server/db/content";

const PAGE_SIZE = 30;

/**
 * GET /api/content?kind=article|video&before={cursor}: a page of the Content
 * feed, newest first. The same for everyone and only refreshed every 15
 * minutes, so the CDN keeps it for a couple of minutes.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const kind = params.get("kind");
  if (kind !== null && !isContentKind(kind)) return json({ error: "Unknown kind." }, 400);
  const rawCursor = params.get("before");
  const before = rawCursor === null ? undefined : decodeCursor(rawCursor);
  if (before === null) return json({ error: "Invalid cursor." }, 400);

  try {
    const page = await listContent(getDb(), { kind: kind ?? undefined, before, limit: PAGE_SIZE });
    const body: ContentPage = {
      items: page.items.map((i) => ({
        ...i,
        source: sourceName(i.source),
        publishedAt: i.publishedAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
    return Response.json(body, {
      headers: { "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Couldn’t load the feed." }, 500);
  }
}
