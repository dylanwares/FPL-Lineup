"use client";

import { useAccount } from "@/account/account";

/*
 * When to sync. This part ships with the planner; the engine itself loads
 * only for signed-in users, the first time it runs.
 */

/** After an edit: wait for a pause, so a burst of moves is one upload. */
export const EDIT_DELAY_MS = 2000;

let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(delay = EDIT_DELAY_MS) {
  if (useAccount.getState().status !== "signed-in") return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void import("./engine").then((m) => m.sync()).catch(() => {});
  }, delay);
}
