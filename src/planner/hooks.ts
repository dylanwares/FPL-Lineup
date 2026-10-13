import { useEffect, useMemo, useState } from "react";
import { stateAt } from "@/engine/plan";
import type { GwState } from "@/engine/types";
import { planResult } from "./model";
import { usePlanner, type PastState } from "./store";

export type GwView =
  { kind: "plan"; state: GwState } | { kind: "past"; picks: PastState | undefined } | { kind: "none" };

/** The planned state (or past picks) for the gameweek on screen. Recomputes only when the plan changes. */
export function useGwView(): GwView {
  const plan = usePlanner((s) => s.plan);
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  const past = usePlanner((s) => s.past[gw]);
  const result = useMemo(() => (plan && data ? planResult(plan, data) : null), [plan, data]);

  if (!plan || !result) return { kind: "none" };
  if (gw < plan.base.gw) return { kind: "past", picks: past };
  const state = stateAt(result, gw);
  return state ? { kind: "plan", state } : { kind: "none" };
}

/** Current time, refreshed every `everyMs` (for countdowns). */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
