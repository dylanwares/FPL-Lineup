"use client";

import { useEffect } from "react";
import { lazyComponent } from "@/lib/lazy";
import { checkSession, useAccount } from "./account";

const signInSheet = lazyComponent(() => import("./SignInSheet").then((m) => m.SignInSheet));

/** Checks who's signed in (in idle time, off the first-load path) and hosts the sign-in sheet. */
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

  return signingIn ? <signInSheet.Lazy /> : null;
}
