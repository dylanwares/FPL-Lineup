"use client";

import { useCallback, useMemo, useState } from "react";
import type { GwState } from "@/engine/types";
import { BestXiSheet } from "./BestXiSheet";
import { CornerStat } from "./CornerStat";
import { engineContext, formatPrice } from "./model";
import { teamRating } from "./rating";
import { usePlanner } from "./store";

const percent = (n: number) => `${Math.round(n)}%`;

/**
 * The rating bar's colour, harsh on purpose: under 75% is red, under 90%
 * amber, 90–94% bright green and 95% or more dark green (the hardest to reach).
 */
export function ratingColor(pct: number): string {
  if (pct < 75) return "var(--injured)";
  if (pct < 90) return "var(--doubt)";
  return pct < 95 ? "var(--mint)" : "var(--fdr-1)";
}

/**
 * How the planned XI's expected points compare with the best XI any legal
 * £100.0m squad could field that gameweek, pinned to the pitch's top-left
 * corner. The perfect XI is in the tooltip and accessible name, and a tap
 * opens it on its own pitch.
 */
export function TeamRating({ state }: { state: GwState }) {
  const data = usePlanner((s) => s.data)!;
  const rules = engineContext(data).rules;
  const rating = useMemo(() => teamRating(data, state, rules), [data, state, rules]);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!rating) {
    return (
      <CornerStat
        testId="team-rating"
        value={null}
        format={percent}
        caption="team rating"
        label="Team rating"
        details={[`No projections for GW${state.gw} yet`]}
      />
    );
  }
  const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
  const budget = formatPrice(rules.squad.budget);
  return (
    <>
      <CornerStat
        testId="team-rating"
        value={rating.pct}
        format={percent}
        caption="team rating"
        meter={{ pct: rating.pct, color: ratingColor(rating.pct) }}
        label={`Team rating ${rating.pct}% in GW${state.gw}`}
        details={[
          `Your XI ${rating.mine.toFixed(1)} xP of the best ${budget} team's ${rating.best.toFixed(1)} xP`,
          `Best XI: ${rating.perfect.xi.map(name).join(", ")}`,
        ]}
        onClick={() => setOpen(true)}
      />
      {open && <BestXiSheet rating={rating} gw={state.gw} slots={state.slots} onClose={close} />}
    </>
  );
}
