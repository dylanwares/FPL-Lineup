import { getPlayerHistory } from "@/lib/fpl/api";
import { fplErrorResponse } from "@/lib/fpl/errors";

/** GET /api/player/{id}/history: what the player scored in each fixture so far this season. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!/^\d{1,4}$/.test(raw) || id < 1) {
    return Response.json({ error: "Invalid player." }, { status: 400 });
  }

  try {
    const history = await getPlayerHistory(id);
    return Response.json(history, { headers: { "cache-control": "private, max-age=300" } });
  } catch (err) {
    return fplErrorResponse(err);
  }
}
