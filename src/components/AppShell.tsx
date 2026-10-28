"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { lazyComponent } from "@/lib/lazy";
import { PlannerApp } from "@/planner/PlannerApp";
import { usePlanner } from "@/planner/store";
import { TAB_TITLES, useTab, type Tab } from "./nav";
import { TabBar } from "./TabBar";

const fixtureTicker = lazyComponent(() => import("@/fixtures/FixtureTicker").then((m) => m.FixtureTicker));
const scoutScreen = lazyComponent(() => import("@/scout/ScoutScreen").then((m) => m.ScoutScreen));
/** Content creation only, so it loads on first use. */
const spotlight = lazyComponent(() => import("@/spotlight/Spotlight").then((m) => m.default));

/**
 * Every screen, kept mounted once opened so switching is instant and each
 * keeps its state and scroll position. The ticker and Scout load in idle
 * time, or on first visit.
 */
export function AppShell() {
  const tab = useTab();
  const spotlightOpen = usePlanner((s) => s.spotlight != null);
  const [tickerOpened, setTickerOpened] = useState(tab === "fixtures");
  if (tab === "fixtures" && !tickerOpened) setTickerOpened(true);
  const [scoutOpened, setScoutOpened] = useState(tab === "scout");
  if (tab === "scout" && !scoutOpened) setScoutOpened(true);

  // Each tab's scroll position, restored when it comes back.
  const scroll = useRef<Record<Tab, number>>({ planner: 0, fixtures: 0, scout: 0 });
  const shown = useRef(tab);
  useLayoutEffect(() => {
    if (shown.current === tab) return;
    shown.current = tab;
    window.scrollTo(0, scroll.current[tab]);
    document.title = TAB_TITLES[tab];
  }, [tab]);
  useEffect(() => {
    const onScroll = () => (scroll.current[shown.current] = window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const load = () => {
      void fixtureTicker.preload().catch(() => {});
      void scoutScreen.preload().catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(load, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(load, 2000);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <div hidden={tab !== "planner"}>
        <PlannerApp />
      </div>
      <div hidden={tab !== "fixtures"}>{tickerOpened && <fixtureTicker.Lazy />}</div>
      <div hidden={tab !== "scout"}>{scoutOpened && <scoutScreen.Lazy active={tab === "scout"} />}</div>
      <TabBar tab={tab} />
      {spotlightOpen && <spotlight.Lazy />}
    </>
  );
}
