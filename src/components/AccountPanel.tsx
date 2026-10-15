"use client";

import { useEffect, useRef } from "react";
import { openSignIn, signOut, useAccount } from "@/account/account";
import { Download, Logout, Mail } from "@/components/ui/Icons";
import { disconnect, showToast, usePlanner } from "@/planner/store";
import { startInstall, useInstallMode } from "./pwa/install";

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none hover:bg-[var(--line)] focus-visible:bg-[var(--line)]";

/** The account menu's contents: sign-in, the connected FPL team, Change FPL team, and Install app. */
export function AccountPanel({ close }: { close: () => void }) {
  const team = usePlanner((s) => s.team);
  const account = useAccount((s) => s);
  const installable = useInstallMode() !== null;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  return (
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
          {account.status === "signed-in" ? (
            <>
              <div className="px-3 pt-2 pb-1">
                <p className="text-[11px] text-muted">Signed in as</p>
                <p className="truncate text-sm font-semibold">{account.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                onClick={() => {
                  close();
                  void signOut().then(() => showToast("Signed out. Your plans stay on this device."));
                }}
              >
                <Logout className="size-4 text-muted" /> Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                close();
                openSignIn();
              }}
            >
              <Mail className="size-4 text-muted" />
              <span>
                Sign in
                <span className="block text-xs text-muted">Sync plans across your devices</span>
              </span>
            </button>
          )}
          <div role="separator" className="mx-2 my-1 h-px bg-[var(--line)]" />
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
                className={ITEM}
                onClick={() => {
                  close();
                  disconnect();
                }}
              >
                <Logout className="size-4 text-muted" /> Change FPL team
              </button>
            </>
          ) : (
            <p className="px-3 py-2.5 text-sm text-muted">Enter your FPL team ID to start planning.</p>
          )}
          {installable && (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                close();
                void startInstall();
              }}
            >
              <Download className="size-4 text-muted" /> Install app
            </button>
          )}
        </div>
      </div>
    </>
  );
}
