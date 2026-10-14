import { lazyComponent } from "@/lib/lazy";

/*
 * Parts of the planner that only appear after a tap. They stay out of
 * first-load JS and are preloaded in idle time once the planner is on screen.
 */
export const playerSheet = lazyComponent(() => import("./PlayerSheet").then((m) => m.PlayerSheet));
export const playerList = lazyComponent(() => import("./PlayerList").then((m) => m.default));
export const planMenus = lazyComponent(() => import("./PlanMenus").then((m) => m.PlanMenus));

export function preloadOnIdle(): () => void {
  const run = () =>
    void Promise.all([playerSheet.preload(), playerList.preload(), planMenus.preload()]).catch(() => {});
  if ("requestIdleCallback" in window) {
    const id = requestIdleCallback(run, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 1500);
  return () => clearTimeout(id);
}
