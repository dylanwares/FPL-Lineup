/** The CDN's sizes: the pitch's small photos, and the share image's larger ones. */
const SIZES = { small: "40x40", large: "110x140" } as const;

/**
 * GET /api/photo/{code}?size=small|large: a player's photo from the Premier
 * League CDN, served from our origin. The CDN sends no CORS headers, so the
 * share image can only draw photos (and still export the canvas) when they
 * come through here; same-origin photos can also be kept for offline use.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const size = new URL(req.url).searchParams.get("size") === "small" ? SIZES.small : SIZES.large;
  if (!/^\d{1,9}$/.test(code)) return new Response("Invalid player code.", { status: 400 });

  const res = await fetch(
    `https://resources.premierleague.com/premierleague25/photos/players/${size}/${code}.png`,
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
