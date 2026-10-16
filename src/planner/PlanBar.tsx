"use client";

import { useState } from "react";
import { ChevronDown, More, Plus, Share } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { planMenus, shareSheet } from "./lazy-parts";
import { openPlanUi, usePlanner } from "./store";

/**
 * New plan, the plan dropdown, Share (the lineup as an image) and the ⋯ menu
 * (plan actions and Refresh from FPL). Changing FPL team lives in the
 * header's account menu.
 */
export function PlanBar() {
  const planName = usePlanner((s) => s.plan?.name);
  const teamName = usePlanner((s) => s.team?.teamName);
  const planUi = usePlanner((s) => s.planUi);
  const refreshError = usePlanner((s) => s.refreshError);
  const [sharing, setSharing] = useState(false);
  const preloadShare = () => void shareSheet.preload().catch(() => {});

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <PillButton size="icon" aria-label="New plan" title="New plan" onClick={() => openPlanUi("create")}>
          <Plus className="size-4" />
        </PillButton>
        <button
          type="button"
          aria-label={`Plan: ${planName}. Switch plan`}
          aria-haspopup="listbox"
          aria-expanded={planUi === "list"}
          onClick={() => openPlanUi(planUi === "list" ? null : "list")}
          className="glass-pill flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl pr-2.5 pl-3.5 text-left"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-mint" />
          <span className="truncate text-[13px] font-semibold">{planName}</span>
          <span className="min-w-0 shrink-[3] truncate text-xs text-muted">· {teamName}</span>
          <ChevronDown
            className={`ml-auto size-4 shrink-0 text-muted transition-transform ${planUi === "list" ? "rotate-180" : ""}`}
          />
        </button>
        <PillButton
          size="icon"
          aria-label="Share lineup"
          title="Share lineup"
          data-guide="share"
          onPointerEnter={preloadShare}
          onPointerDown={preloadShare}
          onFocus={preloadShare}
          onClick={() => setSharing(true)}
        >
          <Share className="size-4" />
        </PillButton>
        <PillButton
          size="icon"
          aria-label="More options"
          title="More options"
          aria-haspopup="menu"
          aria-expanded={planUi === "actions"}
          onClick={() => openPlanUi(planUi === "actions" ? null : "actions")}
        >
          <More className="size-4" />
        </PillButton>
      </div>
      {planUi && <planMenus.Lazy />}
      {sharing && <shareSheet.Lazy onClose={() => setSharing(false)} />}
      {refreshError && (
        <p role="alert" className="px-1 text-xs text-injured">
          Couldn’t refresh your team: {refreshError}
        </p>
      )}
    </div>
  );
}
