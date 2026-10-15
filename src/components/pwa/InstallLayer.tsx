"use client";

import { useEffect } from "react";
import { Close, Share } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { closeIosSteps, dismissBanner, startInstall, useIosSteps } from "./install";

/** The one-time install banner (above the tab bar) and the iOS Add to Home Screen steps. */
export function InstallLayer({ banner }: { banner: boolean }) {
  const iosSteps = useIosSteps();
  // Shown once: acting on it or closing it retires it for good.
  const retire = dismissBanner;

  return (
    <>
      {banner && !iosSteps && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.875rem)+4.75rem)] z-30 flex justify-center px-4">
          <aside
            aria-label="Install the app"
            className="glass-strong toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl p-3 pl-3.5"
          >
            <AppIcon />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install FPL Lineup</p>
              <p className="text-xs text-muted">One tap from your home screen, and it works offline.</p>
            </div>
            <PillButton
              variant="neon"
              size="sm"
              onClick={() => {
                retire();
                void startInstall();
              }}
            >
              Install
            </PillButton>
            <button
              type="button"
              aria-label="Not now"
              onClick={retire}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:text-fg"
            >
              <Close className="size-4" />
            </button>
          </aside>
        </div>
      )}
      {iosSteps && <IosSteps />}
    </>
  );
}

function AppIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static icon
    <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
  );
}

/** iOS has no install dialog: how to add it from the share sheet. */
function IosSteps() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeIosSteps();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fade-in absolute inset-0 bg-black/60"
        onClick={closeIosSteps}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        className="glass-strong sheet-in relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:rounded-3xl"
      >
        <header className="flex items-center gap-3">
          <AppIcon />
          <h2 id="ios-install-title" className="flex-1 font-display text-lg font-bold">
            Add to Home Screen
          </h2>
          <PillButton size="icon" aria-label="Close" onClick={closeIosSteps}>
            <Close className="size-4" />
          </PillButton>
        </header>
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex items-center gap-3">
            <Step n={1} />
            <span>
              Tap{" "}
              <span className="inline-flex translate-y-0.5 items-center text-cyan" aria-label="Share">
                <Share className="size-4" />
              </span>{" "}
              <b>Share</b> in the browser’s toolbar.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Step n={2} />
            <span>
              Scroll down and choose <b>Add to Home Screen</b>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Step n={3} />
            <span>
              Tap <b>Add</b>. FPL Lineup opens full screen, even offline.
            </span>
          </li>
        </ol>
        <PillButton variant="glass" className="justify-center" onClick={closeIosSteps}>
          Got it
        </PillButton>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="accent-soft grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
      {n}
    </span>
  );
}
