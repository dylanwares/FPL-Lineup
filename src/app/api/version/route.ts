import manifest from "@/data/generated/manifest.json";

// Prerendered at build time from the manifest. A short CDN cache lets a data
// refresh reach clients within a minute.
export function GET() {
  return Response.json(manifest, {
    headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
}
