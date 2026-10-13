"use client";

/**
 * Flips [data-theme] on <html> and remembers the choice. Both icons are always
 * rendered and CSS shows the right one, so server and client markup match.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch light or dark theme"
      className="glass-pill grid size-10 place-items-center rounded-xl text-fg"
    >
      {/* Moon, shown in light theme */}
      <svg viewBox="0 0 24 24" className="hidden size-[18px] light:block" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
      </svg>
      {/* Sun, shown in dark theme */}
      <svg viewBox="0 0 24 24" className="size-[18px] light:hidden" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}

/** Runs before first paint so the stored theme never flashes. */
export const themeScript = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
