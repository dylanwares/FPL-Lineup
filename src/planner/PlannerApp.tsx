"use client";

import { useEffect } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillButton } from "@/components/ui/PillButton";
import { ConnectScreen } from "./ConnectScreen";
import { PlannerScreen } from "./PlannerScreen";
import { PlannerSkeleton } from "./PlannerSkeleton";
import { boot, usePlanner } from "./store";

/** The planner's single client island. Server-renders a skeleton, then boots from device storage. */
export function PlannerApp() {
  const phase = usePlanner((s) => s.phase);
  const dataError = usePlanner((s) => s.dataError);

  useEffect(() => {
    void boot();
  }, []);

  if (dataError) {
    return (
      <GlassPanel className="mt-6 flex flex-col items-start gap-3 p-5">
        <h1 className="font-display text-lg font-bold">Couldn’t load game data</h1>
        <p className="text-sm text-muted">Check your connection and try again.</p>
        <PillButton variant="neon" size="sm" onClick={() => void boot()}>
          Retry
        </PillButton>
      </GlassPanel>
    );
  }
  if (phase === "booting") return <PlannerSkeleton />;
  if (phase === "connect" || phase === "importing") return <ConnectScreen />;
  return <PlannerScreen />;
}
