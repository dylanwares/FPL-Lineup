"use client";

import { useEffect } from "react";
import { GwNav } from "./GwNav";
import { PitchView } from "./PitchView";
import { PlanBar } from "./PlanBar";
import { PlayerSheet } from "./PlayerSheet";
import { StatsRow } from "./StatsRow";
import { stepGw, usePlanner } from "./store";

export function PlannerScreen() {
  // ← / → change gameweek on desktop (ignored while typing or with the sheet open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (usePlanner.getState().sheetPlayer != null) return;
      if (e.key === "ArrowLeft") stepGw(-1);
      else if (e.key === "ArrowRight") stepGw(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-3 py-4">
      <PlanBar />
      <GwNav />
      <StatsRow />
      <PitchView />
      <PlayerSheet />
    </div>
  );
}
