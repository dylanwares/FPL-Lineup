"use client";

import { usePathname } from "next/navigation";

/*
 * The app's screens behave like native tabs: all stay mounted and a tab
 * switch only swaps which one shows. The URL still changes (via pushState,
 * which Next's router follows), so /fixtures links, reloads and Back work.
 */

export type Tab = "planner" | "fixtures" | "scout" | "content";

export const TAB_PATHS: Record<Tab, string> = {
  planner: "/",
  fixtures: "/fixtures",
  scout: "/scout",
  content: "/content",
};

export const TAB_TITLES: Record<Tab, string> = {
  planner: "FPL Lineup — Fantasy Premier League planner",
  fixtures: "Fixtures · FPL Lineup",
  scout: "Scout · FPL Lineup",
  content: "Content · FPL Lineup",
};

const tabOf = (pathname: string): Tab =>
  (Object.keys(TAB_PATHS) as Tab[]).find((t) => t !== "planner" && TAB_PATHS[t] === pathname) ?? "planner";

/** A tab's own query string (Scout's filters), put back in the URL when the tab returns. */
const tabSearch: Partial<Record<Tab, string>> = {};

/** Records a tab's query string, and shows it in the URL if that tab is on screen. */
export function setTabSearch(tab: Tab, search: string) {
  tabSearch[tab] = search;
  if (currentTab() === tab && location.search !== search) {
    history.replaceState(history.state, "", TAB_PATHS[tab] + search);
  }
}

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
  history.pushState(null, "", TAB_PATHS[tab] + (tabSearch[tab] ?? ""));
}

/** Lets modified clicks (new tab, new window) through to the link's href. */
export function navClick(tab: Tab) {
  return (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goTo(tab);
  };
}
