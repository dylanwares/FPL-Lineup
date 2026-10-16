import { signedIn, json } from "@/server/api";
import { listPlans } from "@/server/db/plans";

/**
 * GET /api/plans?since={ms}: the signed-in user's plans. With `since`,
 * everything changed after it (deletions included) for an incremental sync.
 */
export function GET(req: Request) {
  return signedIn(async (userId, db) => {
    const raw = new URL(req.url).searchParams.get("since");
    const since = raw === null ? undefined : Number(raw);
    if (since !== undefined && !(Number.isFinite(since) && since >= 0))
      return json({ error: "Invalid since." }, 400);
    return json({ plans: await listPlans(db, userId, { since }) });
  });
}
