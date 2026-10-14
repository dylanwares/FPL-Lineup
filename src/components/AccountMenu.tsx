"use client";

import { useEffect, useRef, useState } from "react";
import { Logout } from "@/components/ui/Icons";
import { disconnect, usePlanner } from "@/planner/store";

/** The account icon: the connected FPL team and Change FPL team. Sign-in joins it in Stage 5. */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const team = usePlanner((s) => s.team);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A tap anywhere outside closes the menu. (The header's backdrop-filter traps
  // `position: fixed`, so a full-screen backdrop button wouldn't cover the page.)
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
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
      {open && (
        <>
          {/* .glass-strong sets position: relative (unlayered, so it beats `absolute`): position a wrapper instead. */}
          <div className="absolute top-12 right-0 z-50 w-64">
            <div
              ref={panel}
              role="menu"
              aria-label="Account"
              className="glass-strong fade-in flex flex-col rounded-xl p-1.5"
              style={{ background: "linear-gradient(var(--glass-solid), var(--glass-solid)), var(--bg)" }}
            >
              {team ? (
                <>
                  <div className="px-3 pt-2 pb-2.5">
                    <p className="truncate text-sm font-semibold">{team.teamName}</p>
                    <p className="text-xs text-muted">FPL team ID {team.entryId}</p>
                  </div>
                  <div role="separator" className="mx-2 mb-1 h-px bg-[var(--line)]" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none hover:bg-[var(--line)] focus-visible:bg-[var(--line)]"
                    onClick={() => {
                      setOpen(false);
                      disconnect();
                    }}
                  >
                    <Logout className="size-4 text-muted" /> Change FPL team
                  </button>
                </>
              ) : (
                <p className="px-3 py-2.5 text-sm text-muted">
                  Enter your FPL team ID to start planning. Accounts to sync plans are coming soon.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
