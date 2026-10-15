import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

/*
 * Accounts: Neon Auth (managed Better Auth), signed in with a 6-digit code
 * sent by email. Its endpoints are proxied under our own /api/auth, so the
 * session cookie belongs to our domain (and works in the installed app).
 */

let instance: ReturnType<typeof createNeonAuth> | undefined;

/** Created on first use, so builds and pages that never touch auth don't need the env vars. */
export function auth() {
  if (instance) return instance;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set.");
  instance = createNeonAuth({ baseUrl, cookies: { secret } });
  return instance;
}

/** The signed-in user's id, or null. For route handlers and server actions. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await auth().getSession();
  return data?.user?.id ?? null;
}
