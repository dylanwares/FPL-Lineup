"use client";

import { useLayoutEffect, useRef } from "react";
import { navClick, TAB_PATHS, type Tab } from "./nav";

const TABS: { tab: Tab; label: string; icon: React.ReactNode }[] = [
  {
    tab: "planner",
    label: "Planner",
    icon: (
      // A pitch: touchlines, halfway line and centre circle.
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true">
        <rect
          x="4"
          y="2.75"
          width="16"
          height="18.5"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    tab: "fixtures",
    label: "Fixtures",
    icon: (
      // A calendar grid.
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true">
        <rect
          x="3"
          y="4.5"
          width="18"
          height="16.5"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M3 9.5h18M8 2.75v3.5M16 2.75v3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.75h2M11 16.75h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    tab: "scout",
    label: "Scout",
    icon: (
      // A magnifying glass.
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15.25 15.25 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    tab: "content",
    label: "Content",
    icon: (
      // A folded newspaper: a headline, a picture and columns of text.
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true">
        <path
          d="M17.5 7.5h2.25a1.25 1.25 0 0 1 1.25 1.25v9.5a2.5 2.5 0 0 1-5 0V5.25A1.25 1.25 0 0 0 14.75 4H4.25A1.25 1.25 0 0 0 3 5.25v13a2.75 2.75 0 0 0 2.75 2.75h12.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <rect x="6.5" y="7.5" width="5" height="4" rx="0.75" fill="currentColor" />
        <path d="M6.5 14.75h6M6.5 17.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * A floating liquid-glass tab bar, after iOS 26: a frosted capsule with a
 * specular rim, and a glass lens behind the selected tab that slides across
 * with a stretch and a springy settle. Plain CSS and one Web Animation.
 */
export function TabBar({ tab }: { tab: Tab }) {
  const index = TABS.findIndex((t) => t.tab === tab);
  const lens = useRef<HTMLSpanElement>(null);
  const shown = useRef(index);

  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    if (from === index || !lens.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Like a drop of liquid: it stretches as it travels, then settles with a little overshoot.
    const x = (i: number) => `${i * 100}%`;
    lens.current.animate(
      [
        { transform: `translateX(${x(from)}) scale(1, 1)` },
        { transform: `translateX(${x((from + index) / 2)}) scale(1.22, 0.88)`, offset: 0.4 },
        { transform: `translateX(${x(index)}) scale(1, 1)` },
      ],
      { duration: 520, easing: "cubic-bezier(0.3, 1.25, 0.45, 1)" },
    );
  }, [index]);

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)]"
    >
      <div className="tabbar pointer-events-auto relative flex rounded-full p-1">
        <span
          ref={lens}
          aria-hidden="true"
          className="tabbar-lens absolute inset-y-1 left-1 w-[4.75rem] rounded-full"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {TABS.map((t) => (
          <a
            key={t.tab}
            href={TAB_PATHS[t.tab]}
            onClick={navClick(t.tab)}
            aria-current={t.tab === tab ? "page" : undefined}
            className="tabbar-tab relative flex w-[4.75rem] flex-col items-center gap-0.5 rounded-full pt-1.5 pb-1 text-[10px] font-semibold"
          >
            {t.icon}
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
