"use client";

import { useMemo } from "react";
import type { GwState } from "@/engine/types";
import { CornerStat } from "./CornerStat";
import { engineContext } from "./model";
import { projectGw } from "./projection";
import { usePlanner } from "./store";

const points = (n: number) => n.toFixed(1);

/**
 * The planned gameweek's expected points, pinned to the pitch's top-right
 * corner: the armband, chips and bench order applied, any hit taken off. The
 * working (captain, auto-subs, hit) is in the tooltip and accessible name.
 */
export function ProjectedPoints({ state }: { state: GwState }) {
  const data = usePlanner((s) => s.data)!;
  const p = useMemo(() => projectGw(data, state, engineContext(data).rules), [data, state]);

  const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
  const value = p.unknown ? null : p.net;
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
    <CornerStat
      testId="projected-points"
      value={value}
      format={points}
      caption="expected points"
      label={`${value === null ? "–" : points(value)} expected points in GW${state.gw}`}
      details={details}
    />
  );
}
