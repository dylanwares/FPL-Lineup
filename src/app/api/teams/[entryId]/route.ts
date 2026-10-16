import { json, readJson, signedIn } from "@/server/api";
import { removeSavedTeam, saveTeam } from "@/server/db/saved-teams";

type Ctx = { params: Promise<{ entryId: string }> };

const entry = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 1e9 ? id : null;
};

/** PUT /api/teams/{entryId} { label }: links an FPL team to the account (or relabels it). */
export function PUT(req: Request, ctx: Ctx) {
  return signedIn(async (userId, db) => {
    const entryId = entry((await ctx.params).entryId);
    const { label } = ((await readJson(req)) ?? {}) as { label?: unknown };
    const text = typeof label === "string" ? label.trim().slice(0, 60) : "";
    if (!entryId || !text) return json({ error: "Invalid team or label." }, 400);
    await saveTeam(db, userId, { entryId, label: text });
    return json({ entryId, label: text });
  });
}

/** DELETE /api/teams/{entryId}: unlinks a team (its plans stay). */
export function DELETE(_req: Request, ctx: Ctx) {
  return signedIn(async (userId, db) => {
    const entryId = entry((await ctx.params).entryId);
    if (!entryId) return json({ error: "Invalid team." }, 400);
    await removeSavedTeam(db, userId, entryId);
    return json({ entryId });
  });
}
