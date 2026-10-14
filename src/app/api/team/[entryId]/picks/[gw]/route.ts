import { getRules } from "@/config/rules";
import { getBootstrapSlim, getLivePoints, getPicks } from "@/lib/fpl/api";
import { toPastPicks } from "@/lib/fpl/build-import";
import { fplErrorResponse, parseEntryId } from "@/lib/fpl/errors";

/** GET /api/team/{entryId}/picks/{gw}: the team actually picked in a past gameweek, and what each player scored. */
export async function GET(_req: Request, ctx: { params: Promise<{ entryId: string; gw: string }> }) {
  const params = await ctx.params;
  const entryId = parseEntryId(params.entryId);
  const gw = Number(params.gw);
  if (!entryId || !Number.isInteger(gw) || gw < 1 || gw > getRules().lastGw) {
    return Response.json({ error: "Invalid team or gameweek." }, { status: 400 });
  }

  try {
    const bootstrap = await getBootstrapSlim();
    const event = bootstrap.events.find((e) => e.id === gw);
    if (!event || (!event.finished && !event.is_current)) {
      return Response.json({ error: "That gameweek hasn't started yet." }, { status: 404 });
    }
    const [raw, live] = await Promise.all([
      getPicks(entryId, gw, event.finished),
      getLivePoints(gw, event.finished),
    ]);
    const picks = toPastPicks(gw, raw, live);
    return Response.json(picks, {
      headers: { "cache-control": event.finished ? "private, max-age=86400" : "private, max-age=60" },
    });
  } catch (err) {
    return fplErrorResponse(err);
  }
}
