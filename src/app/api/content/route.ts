import { cacheLife } from "next/cache";
import { loadContent } from "@/content/load";
import type { ContentFeed } from "@/content/model";

/**
 * GET /api/content: the latest FPL articles and videos from every source,
 * newest first. Read live from the feeds, then cached: after 5 minutes the
 * next request still gets the cached copy while a fresh one is fetched in
 * the background, so visitors never wait on the feeds unless the cache has
 * sat unused for a day.
 */
export async function GET() {
  return Response.json(await latestContent());
}

async function latestContent(): Promise<ContentFeed> {
  "use cache";
  const items = await loadContent();
  // Every source failing is likely a blip: try again soon rather than keep an empty feed.
  if (items.length) cacheLife({ stale: 60, revalidate: 300, expire: 86_400 });
  else cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  return { items };
}
