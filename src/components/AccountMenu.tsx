"use client";

import { useEffect, useRef, useState } from "react";
import { lazyComponent } from "@/lib/lazy";

// The menu's contents load on first hover, focus or tap, not with the page.
const accountPanel = lazyComponent(() => import("./AccountPanel").then((m) => m.AccountPanel));
const preload = () => void accountPanel.preload().catch(() => {});

/** The account icon: the connected FPL team and Change FPL team. Sign-in joins it in Stage 5. */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A tap anywhere outside closes the menu. (The header's backdrop-filter traps
  // `position: fixed`, so a full-screen backdrop button wouldn't cover the page.)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onPointerEnter={preload}
        onFocus={preload}
        className="glass-pill grid size-10 place-items-center rounded-xl text-fg"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
          <circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4 20.5c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && <accountPanel.Lazy close={() => setOpen(false)} />}
    </div>
  );
}
