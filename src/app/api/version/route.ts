import { getBootstrap } from "@/server/bootstrap";

// The current bootstrap hash and gameweek. The data behind it refreshes on the
// server (see getBootstrap); a short CDN cache lets a refresh reach clients
// within a minute.
export async function GET() {
  const { manifest } = await getBootstrap();
  return Response.json(manifest, {
    headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
}
