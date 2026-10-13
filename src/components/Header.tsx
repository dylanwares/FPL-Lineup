import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="glass-strong mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-2xl pr-2 pl-4">
        <Link href="/" aria-label="FPL Lineup home" className="text-fg">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {/* Sign-in arrives in Stage 5. */}
          <button
            type="button"
            aria-label="Account"
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
        </div>
      </div>
    </header>
  );
}
