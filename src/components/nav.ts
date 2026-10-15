"use client";

import { usePathname } from "next/navigation";

/*
 * The app's two screens behave like native tabs: both stay mounted and a tab
 * switch only swaps which one shows. The URL still changes (via pushState,
 * which Next's router follows), so /fixtures links, reloads and Back work.
 */

export type Tab = "planner" | "fixtures";

export const TAB_PATHS: Record<Tab, string> = { planner: "/", fixtures: "/fixtures" };

export const TAB_TITLES: Record<Tab, string> = {
  planner: "FPL Lineup — Fantasy Premier League planner",
  fixtures: "Fixtures · FPL Lineup",
};

const tabOf = (pathname: string): Tab => (pathname === TAB_PATHS.fixtures ? "fixtures" : "planner");

export function useTab(): Tab {
  return tabOf(usePathname());
}

/** The tab on screen, for code outside React (e.g. the planner's keyboard shortcuts). */
export function currentTab(): Tab {
  return tabOf(location.pathname);
}

/** Shows a tab. Tapping the tab already on screen scrolls it back to the top, as on iOS. */
export function goTo(tab: Tab) {
  if (tab === currentTab()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  history.pushState(null, "", TAB_PATHS[tab]);
}

/** Lets modified clicks (new tab, new window) through to the link's href. */
export function navClick(tab: Tab) {
  return (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goTo(tab);
  };
}
