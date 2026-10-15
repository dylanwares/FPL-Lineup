import { eq } from "drizzle-orm";
import { plans, savedTeams } from "./schema";
import type { Db } from "./types";

/**
 * Everything we store for a user. Neon Auth owns the account itself, and our
 * tables can't cascade from it, so deleting an account must call this too.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(plans).where(eq(plans.userId, userId));
    await tx.delete(savedTeams).where(eq(savedTeams.userId, userId));
  });
}
