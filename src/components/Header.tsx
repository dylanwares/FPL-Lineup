import { AccountMenu } from "./AccountMenu";
import { HomeLink } from "./HomeLink";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div className="glass-strong mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-2xl pr-2 pl-4">
        <HomeLink>
          <Wordmark />
        </HomeLink>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
