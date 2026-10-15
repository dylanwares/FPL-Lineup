"use client";

import { create } from "zustand";

/*
 * Who's signed in, and the email-code sign-in calls. These talk to our
 * /api/auth proxy of Neon Auth with plain fetch: the auth SDK's browser
 * client would add tens of KB to the planner for four requests.
 */

export interface AccountState {
  /** "unknown" until the session has been checked (or while offline with no record of one). */
  status: "unknown" | "signed-out" | "signed-in";
  email: string | null;
  userId: string | null;
  /** The sign-in sheet is open. */
  signingIn: boolean;
}

export const useAccount = create<AccountState>(() => ({
  status: "unknown",
  email: null,
  userId: null,
  signingIn: false,
}));

const set = useAccount.setState;
const LAST_KEY = "fpl-lineup:account";

function remember(user: { id: string; email: string } | null) {
  try {
    if (user) localStorage.setItem(LAST_KEY, JSON.stringify(user));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    // Storage blocked: the account just isn't shown offline.
  }
}

function lastKnown(): { id: string; email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** A failed auth call, with Better Auth's error code when it gave one. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new AuthError(
      navigator.onLine ? "Couldn't reach the server. Try again." : "You're offline.",
      "NETWORK",
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as { code?: string; message?: string };
    throw new AuthError(err.message ?? `Request failed (${res.status}).`, err.code, res.status);
  }
  return data as T;
}

/** Asks the server who's signed in. Offline, the last signed-in account stands. */
export async function checkSession(): Promise<void> {
  try {
    const session = await call<{ user?: { id: string; email: string } } | null>("get-session");
    const user = session?.user ?? null;
    remember(user ? { id: user.id, email: user.email } : null);
    set(
      user
        ? { status: "signed-in", email: user.email, userId: user.id }
        : { status: "signed-out", email: null, userId: null },
    );
  } catch {
    const last = lastKnown();
    set(
      last
        ? { status: "signed-in", email: last.email, userId: last.id }
        : { status: "unknown", email: null, userId: null },
    );
  }
}

/** Emails a sign-in code. Works for new and returning people alike. */
export function sendCode(email: string): Promise<unknown> {
  return call("email-otp/send-verification-otp", { email, type: "sign-in" });
}

/** Signs in with the emailed code, then reads back the session. */
export async function verifyCode(email: string, otp: string): Promise<void> {
  await call("sign-in/email-otp", { email, otp });
  await checkSession();
}

export async function signOut(): Promise<void> {
  await call("sign-out", {}).catch(() => {});
  remember(null);
  set({ status: "signed-out", email: null, userId: null });
}

export function openSignIn() {
  set({ signingIn: true });
}

export function closeSignIn() {
  set({ signingIn: false });
}
