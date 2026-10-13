// Stub sink for real-user web vitals: logs one line per metric so they show in
// Vercel logs. Swap for an analytics store when we need dashboards.
export async function POST(request: Request) {
  try {
    const m = (await request.json()) as { name?: string; value?: number; rating?: string; path?: string };
    if (typeof m.name === "string" && typeof m.value === "number") {
      console.log(`[web-vitals] ${m.name}=${Math.round(m.value)} ${m.rating ?? ""} ${m.path ?? ""}`);
    }
  } catch {
    // Ignore malformed beacons.
  }
  return new Response(null, { status: 204 });
}
