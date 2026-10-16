import { json, signedIn } from "@/server/api";
import { listSavedTeams } from "@/server/db/saved-teams";

/** GET /api/teams: the FPL teams linked to the signed-in account. */
export function GET() {
  return signedIn(async (userId, db) => json({ teams: await listSavedTeams(db, userId) }));
}
