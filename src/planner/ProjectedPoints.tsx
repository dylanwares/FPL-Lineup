"use client";

import { useMemo } from "react";
import type { GwState } from "@/engine/types";
import { engineContext } from "./model";
import { projectGw } from "./projection";
import { usePlanner } from "./store";

/**
 * The planned gameweek's expected points, pinned to the pitch's top-right
 * corner: the armband, chips and bench order applied, any hit taken off. The
 * working (captain, auto-subs, hit) is in the tooltip and accessible name.
 */
export function ProjectedPoints({ state }: { state: GwState }) {
  const data = usePlanner((s) => s.data)!;
  const p = useMemo(() => projectGw(data, state, engineContext(data).rules), [data, state]);

  const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
  const value = p.unknown ? "–" : p.net.toFixed(1);
  const details = p.unknown
    ? [`No projections for GW${state.gw} yet`]
    : [
        p.captain !== null &&
          `${p.captain === state.captain ? "Captain" : "Vice (captain not expected to play)"} ${name(p.captain)} ×${p.multiplier}`,
        p.benchBoost !== null && `Bench Boost +${p.benchBoost.toFixed(1)}`,
        ...p.autoSubs.map((s) => `Auto-sub: ${name(s.in)} for ${name(s.out)}`),
        p.hit > 0 && `${p.total.toFixed(1)} before the -${p.hit} hit`,
      ].filter((d): d is string => !!d);

  return (
    // .glass-pill sets position: relative, so the pitch positions a wrapper round this.
    <div
      data-testid="projected-points"
      role="img"
      aria-label={`${value} expected points in GW${state.gw}. ${details.join(". ")}`}
      title={details.join("\n")}
      className="glass-pill flex size-16 flex-col items-center justify-center gap-1 rounded-xl"
    >
      <span
        data-testid="projected-total"
        className="font-display text-lg leading-none font-bold text-fg tabular-nums"
      >
        {value}
      </span>
      <span className="text-center text-[8px] leading-[1.15] font-medium tracking-[0.06em] text-muted uppercase">
        expected points
      </span>
    </div>
  );
}
