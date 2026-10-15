/**
 * GET /api/photo/{code}: a player's photo from the Premier League CDN, served
 * from our origin. The CDN sends no CORS headers, so the share image can only
 * draw photos (and still export the canvas) when they come through here.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^\d{1,9}$/.test(code)) return new Response("Invalid player code.", { status: 400 });

  const res = await fetch(
    `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`,
  ).catch(() => null);
  if (!res?.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    return new Response("No photo.", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
  }
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type")!,
      // Photos rarely change within a season.
      "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
