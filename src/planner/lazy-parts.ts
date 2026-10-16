import { createElement } from "react";
import { lazyComponent } from "@/lib/lazy";
import { CornerStat } from "./CornerStat";

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
/** Its solver is a few KB, so the box shows "–" for the moment it takes to arrive. */
export const teamRating = lazyComponent(
  () => import("./TeamRating").then((m) => m.TeamRating),
  createElement(CornerStat, {
    testId: "team-rating",
    value: null,
    format: String,
    caption: "team rating",
    label: "Team rating",
  }),
);
/** The first-run tour: once per device, so it loads only when it's due (or replayed). */
export const plannerGuide = lazyComponent(() => import("./PlannerGuide").then((m) => m.PlannerGuide));
export const planMenus = lazyComponent(() => import("./PlanMenus").then((m) => m.PlanMenus));

export function preloadOnIdle(): () => void {
  const run = () =>
    void Promise.all([
      playerSheet.preload(),
      playerList.preload(),
      planMenus.preload(),
      teamRating.preload(),
      toaster.preload(),
    ]).catch(() => {});
  if ("requestIdleCallback" in window) {
    const id = requestIdleCallback(run, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 1500);
  return () => clearTimeout(id);
}
