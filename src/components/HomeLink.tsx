"use client";

import { navClick, TAB_PATHS } from "./nav";

/** The wordmark: back to the planner tab, in place. */
export function HomeLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href={TAB_PATHS.planner}
      onClick={navClick("planner")}
      aria-label="FPL Lineup home"
      className="text-fg"
    >
      {children}
    </a>
  );
}
