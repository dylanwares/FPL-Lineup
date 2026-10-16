import { json, readJson, signedIn } from "@/server/api";
import { deletePlan, savePlan, type SaveResult } from "@/server/db/plans";
import { isUuid, parsePlan, parseVersion } from "@/server/plan-input";

type Ctx = { params: Promise<{ id: string }> };

/** saved → 200 { plan }, conflict → 409 { current }, missing → 404. */
function reply(result: SaveResult) {
  if (result.status === "saved") return json({ plan: result.plan });
  if (result.status === "conflict") return json({ current: result.current }, 409);
  return json({ error: "No such plan." }, 404);
}

/**
 * PUT /api/plans/{id} { plan, baseVersion }: saves a plan. `baseVersion` is
 * the version the device last had (null for a plan new to the server); if the
 * server has moved on since, nothing is written and the reply is a 409.
 */
export function PUT(req: Request, ctx: Ctx) {
  return signedIn(async (userId, db) => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const { plan, baseVersion } = (body ?? {}) as { plan?: unknown; baseVersion?: unknown };
    return reply(await savePlan(db, userId, parsePlan(plan, id), parseVersion(baseVersion)));
  });
}

/** DELETE /api/plans/{id}?version={n}: deletes a plan (if it's still at version n). */
export function DELETE(req: Request, ctx: Ctx) {
  return signedIn(async (userId, db) => {
    const { id } = await ctx.params;
    const version = parseVersion(Number(new URL(req.url).searchParams.get("version")));
    if (!isUuid(id) || version === null) return json({ error: "Invalid plan or version." }, 400);
    return reply(await deletePlan(db, userId, id, version));
  });
}
