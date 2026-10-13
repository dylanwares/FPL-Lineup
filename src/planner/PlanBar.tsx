"use client";

import { Logout, Refresh } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { disconnect, refreshTeam, usePlanner } from "./store";

/** Plan name and team. Named plans (new / rename / delete) arrive in Stage 4. */
export function PlanBar() {
  const planName = usePlanner((s) => s.plan?.name);
  const teamName = usePlanner((s) => s.team?.teamName);
  const refreshing = usePlanner((s) => s.refreshing);
  const refreshError = usePlanner((s) => s.refreshError);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="glass-pill flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3.5">
          <span className="size-1.5 shrink-0 rounded-full bg-mint" />
          <span className="truncate text-[13px] font-semibold">{planName}</span>
          <span className="truncate text-xs text-muted">· {teamName}</span>
        </div>
        <PillButton
          size="icon"
          aria-label="Refresh team from FPL"
          title="Refresh team from FPL"
          disabled={refreshing}
          onClick={() => void refreshTeam()}
        >
          <Refresh className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </PillButton>
        <PillButton size="icon" aria-label="Switch team" title="Switch team" onClick={disconnect}>
          <Logout className="size-4" />
        </PillButton>
      </div>
      {refreshError && (
        <p role="alert" className="px-1 text-xs text-injured">
          Couldn’t refresh your team: {refreshError}
        </p>
      )}
    </div>
  );
}
