"use client";

import { useEffect } from "react";
import { currentTab, useTab } from "@/components/nav";
import { ChipsRow } from "./ChipsRow";
import { GwNav } from "./GwNav";
import { MetricRow } from "./MetricRow";
import { planHistory, playerList, playerSheet, plannerGuide, preloadOnIdle, toaster } from "./lazy-parts";
import { ModeBar } from "./ModeBar";
import { PitchView } from "./PitchView";
import { PlanBar } from "./PlanBar";
import { StatsRow } from "./StatsRow";
import { clearSelection, exitMode, guideDue, openGuide, stepGw, usePlanner } from "./store";

/** How long the planner settles on screen before the first-run guide starts. */
const GUIDE_DELAY_MS = 700;

export function PlannerScreen() {
  // ← / → change gameweek on desktop; Escape cancels a selection, then the mode.
  // Ignored while typing or with a sheet, menu or dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || currentTab() !== "planner") return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const { sheetPlayer, mode, selected, planUi } = usePlanner.getState();
      if (sheetPlayer != null || planUi !== null || (mode === "transfer" && selected !== null)) return;
      if (e.key === "ArrowLeft") stepGw(-1);
      else if (e.key === "ArrowRight") stepGw(1);
      else if (e.key === "Escape" && selected !== null) clearSelection();
      else if (e.key === "Escape" && mode !== "none") exitMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(preloadOnIdle, []);

  // The first time the planner appears on this device, the guide follows (loading meanwhile).
  useEffect(() => {
    if (!guideDue()) return;
    void plannerGuide.preload().catch(() => {});
    const id = setTimeout(openGuide, GUIDE_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-3 py-4">
      <PlanBar />
      <GwNav />
      <MetricRow />
      <StatsRow />
      <ChipsRow />
      <PitchView />
      <ModeBar />
      <planHistory.Lazy />
      <Sheet />
      <TransferList />
      <Toasts />
      <Guide />
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

/** The guide waits for the Planner tab (it may be due while Fixtures is on screen). */
function Guide() {
  const open = usePlanner((s) => s.guide);
  const tab = useTab();
  return open && tab === "planner" ? <plannerGuide.Lazy /> : null;
}

function Toasts() {
  const any = usePlanner((s) => s.toasts.length > 0);
  return any ? <toaster.Lazy /> : null;
}
