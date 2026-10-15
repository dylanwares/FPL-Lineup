import { AccountMenu } from "./AccountMenu";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="glass-strong mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-2xl pr-2 pl-4">
        {/* A plain link: next/link would add its router code to first-load JS for one tap. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" aria-label="FPL Lineup home" className="text-fg">
          <Wordmark />
        </a>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
