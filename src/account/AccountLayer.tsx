"use client";

import { useEffect } from "react";
import { lazyComponent } from "@/lib/lazy";
import { scheduleSync } from "@/sync/trigger";
import { checkSession, useAccount } from "./account";

const signInSheet = lazyComponent(() => import("./SignInSheet").then((m) => m.SignInSheet));

/** Coming back to the app checks for edits made elsewhere, at most this often. */
const FOREGROUND_SYNC_MS = 30_000;

/**
 * Checks who's signed in (in idle time, off the first-load path), syncs plans
 * when that's someone and whenever the app comes back online or to the
 * foreground, and hosts the sign-in sheet.
 */
export function AccountLayer() {
  const signingIn = useAccount((s) => s.signingIn);

  useEffect(() => {
    const run = () => void checkSession();
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let last = 0;
    const now = () => {
      last = Date.now();
      scheduleSync(0);
    };
    const unsubscribe = useAccount.subscribe((s, prev) => {
      if (s.status === "signed-in" && (prev.status !== "signed-in" || s.userId !== prev.userId)) now();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > FOREGROUND_SYNC_MS) now();
    };
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return signingIn ? <signInSheet.Lazy /> : null;
}
