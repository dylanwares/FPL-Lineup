import { and, asc, eq } from "drizzle-orm";
import { savedTeams } from "./schema";
import type { Db } from "./types";

export interface SavedTeam {
  entryId: number;
  label: string;
}

/** The FPL teams linked to an account, in the order they were added. */
export async function listSavedTeams(db: Db, userId: string): Promise<SavedTeam[]> {
  return db
    .select({ entryId: savedTeams.entryId, label: savedTeams.label })
    .from(savedTeams)
    .where(eq(savedTeams.userId, userId))
    .orderBy(asc(savedTeams.createdAt));
}

/** Links a team to the account, or renames it if it's already linked. */
export async function saveTeam(db: Db, userId: string, team: SavedTeam): Promise<void> {
  await db
    .insert(savedTeams)
    .values({ userId, ...team })
    .onConflictDoUpdate({ target: [savedTeams.userId, savedTeams.entryId], set: { label: team.label } });
}

export async function removeSavedTeam(db: Db, userId: string, entryId: number): Promise<void> {
  await db.delete(savedTeams).where(and(eq(savedTeams.userId, userId), eq(savedTeams.entryId, entryId)));
}
