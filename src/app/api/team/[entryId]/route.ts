import { getRules } from "@/config/rules";
import { getBootstrapSlim, getEntry, getHistory, getPicks, getTransfers } from "@/lib/fpl/api";
import { buildTeamImport } from "@/lib/fpl/build-import";
import { fplErrorResponse, parseEntryId } from "@/lib/fpl/errors";

/** GET /api/team/{entryId}: the squad, bank, free transfers, chips and prices to plan from. */
export async function GET(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const entryId = parseEntryId((await ctx.params).entryId);
  if (!entryId) return Response.json({ error: "Team IDs are numbers only." }, { status: 400 });

  try {
    const [bootstrap, entry, history, transfers] = await Promise.all([
      getBootstrapSlim(),
      getEntry(entryId),
      getHistory(entryId),
      getTransfers(entryId),
    ]);
    const gw = entry.current_event;
    const finished = (n: number) => bootstrap.events.find((e) => e.id === n)?.finished ?? false;
    const picks = gw ? await getPicks(entryId, gw, finished(gw)) : undefined;
    const prePicks =
      gw && picks?.active_chip === "freehit" && gw > 1 ? await getPicks(entryId, gw - 1, true) : undefined;

    const team = buildTeamImport(
      { entry, history, transfers, picks: picks!, prePicks, bootstrap },
      getRules(),
    );
    return Response.json(team, {
      headers: { "cache-control": "private, max-age=60" },
    });
  } catch (err) {
    return fplErrorResponse(err);
  }
}
