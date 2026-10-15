import { lazyComponent } from "@/lib/lazy";

/*
 * Parts of the planner that only appear after a tap (or, for the history,
 * below the fold). They stay out of
 * first-load JS and are preloaded in idle time once the planner is on screen.
 */
export const playerSheet = lazyComponent(() => import("./PlayerSheet").then((m) => m.PlayerSheet));
export const playerList = lazyComponent(() => import("./PlayerList").then((m) => m.default));
/** Below the pitch, so it can arrive just after first paint. */
export const planHistory = lazyComponent(() => import("./PlanHistory").then((m) => m.PlanHistory));
/** Toasts only follow an edit, by which time this has loaded. */
export const toaster = lazyComponent(() => import("./Toaster").then((m) => m.Toaster));
export const shareSheet = lazyComponent(() => import("@/share/ShareSheet").then((m) => m.default));
export const planMenus = lazyComponent(() => import("./PlanMenus").then((m) => m.PlanMenus));

export function preloadOnIdle(): () => void {
  const run = () =>
    void Promise.all([
      playerSheet.preload(),
      playerList.preload(),
      planMenus.preload(),
      toaster.preload(),
    ]).catch(() => {});
  if ("requestIdleCallback" in window) {
    const id = requestIdleCallback(run, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 1500);
  return () => clearTimeout(id);
}
