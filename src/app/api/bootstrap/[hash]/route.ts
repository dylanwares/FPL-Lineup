import { getBootstrap } from "@/server/bootstrap";

/**
 * GET /api/bootstrap/{hash}: the game data file /api/version points at.
 * The current hash is immutable, so browsers and the CDN keep it for good.
 * An older hash (a client holding a manifest from just before a refresh)
 * gets the current data uncached; its next version check then sees the new
 * hash and downloads it under that URL.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const [{ hash }, { json, manifest }] = await Promise.all([ctx.params, getBootstrap()]);
  const current = hash === manifest.hash;
  return new Response(json, {
    headers: {
      "content-type": "application/json",
      "cache-control": current ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}
