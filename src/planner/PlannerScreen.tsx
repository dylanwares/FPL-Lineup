"use client";

import { useEffect } from "react";
import { ChipsRow } from "./ChipsRow";
import { GwNav } from "./GwNav";
import { playerList, playerSheet, preloadOnIdle } from "./lazy-parts";
import { ModeBar } from "./ModeBar";
import { PitchView } from "./PitchView";
import { PlanHistory } from "./PlanHistory";
import { PlanBar } from "./PlanBar";
import { StatsRow } from "./StatsRow";
import { clearSelection, exitMode, stepGw, usePlanner } from "./store";
import { Toaster } from "./Toaster";

export function PlannerScreen() {
  // ← / → change gameweek on desktop; Escape cancels a selection, then the mode.
  // Ignored while typing or with a sheet open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const { sheetPlayer, mode, selected } = usePlanner.getState();
      if (sheetPlayer != null || (mode === "transfer" && selected !== null)) return;
      if (e.key === "ArrowLeft") stepGw(-1);
      else if (e.key === "ArrowRight") stepGw(1);
      else if (e.key === "Escape" && selected !== null) clearSelection();
      else if (e.key === "Escape" && mode !== "none") exitMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(preloadOnIdle, []);

  return (
    <div className="flex flex-col gap-3 py-4">
      <PlanBar />
      <GwNav />
      <StatsRow />
      <ChipsRow />
      <PitchView />
      <ModeBar />
      <PlanHistory />
      <Sheet />
      <TransferList />
      <Toaster />
    </div>
  );
}

function TransferList() {
  const open = usePlanner((s) => s.mode === "transfer" && s.selected !== null);
  return open ? <playerList.Lazy /> : null;
}

function Sheet() {
  const open = usePlanner((s) => s.sheetPlayer !== null);
  return open ? <playerSheet.Lazy /> : null;
}
