import "server-only";
import { connection } from "next/server";
import { currentUserId } from "./auth";
import { getDb } from "./db";
import type { Db } from "./db/types";
import { InputError } from "./plan-input";

/*
 * Shared plumbing for the signed-in APIs (plans, saved teams): who's asking,
 * JSON in and out, never cached, and errors as { error } with a status.
 */

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const MAX_BODY_BYTES = 256 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new InputError("Too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new InputError("Invalid JSON.");
  }
}

/** Runs `fn` for the signed-in user, or answers 401. Bad input is a 400. */
export async function signedIn(fn: (userId: string, db: Db) => Promise<Response>): Promise<Response> {
  // Per user, per request: never prerendered at build time.
  await connection();
  const userId = await currentUserId().catch(() => null);
  if (!userId) return json({ error: "Sign in to sync plans." }, 401);
  try {
    return await fn(userId, getDb());
  } catch (err) {
    if (err instanceof InputError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "Something went wrong." }, 500);
  }
}
