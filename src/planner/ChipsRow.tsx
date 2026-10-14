"use client";

import { useMemo } from "react";
import type { ChipName } from "@/config/rules";
import { ChipTile, type ChipState } from "@/components/ui/ChipTile";
import { chipAvailability, chipStatus, type ChipStatus } from "@/engine/chips";
import { useGwView } from "./hooks";
import { CHIP_NAMES, CHIP_SHORT, CHIPS, engineContext, planResult } from "./model";
import { toggleChip, usePlanner } from "./store";

interface Tile {
  state: ChipState;
  detail: string;
  disabled?: boolean;
}

function tileFor(status: ChipStatus): Tile {
  switch (status.kind) {
    case "played":
      return { state: "played", detail: "Playing" };
    case "available":
      return { state: "available", detail: "Available" };
    case "planned":
      return { state: "planned", detail: `Planned GW${status.gws.join(", ")}` };
    case "used":
      return { state: "used", detail: `Used GW${status.gw}` };
    case "unavailable":
      return { state: "used", detail: status.from ? `From GW${status.from}` : "Unavailable" };
  }
}

/**
 * Wildcard, Free Hit, Triple Captain and Bench Boost for the gameweek on
 * screen. Tapping plays a chip or cancels it; past gameweeks are read-only.
 */
export function ChipsRow() {
  const view = useGwView();
  const plan = usePlanner((s) => s.plan);
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  const chipsUsed = usePlanner((s) => s.team?.chipsUsed);

  const tiles = useMemo((): Record<ChipName, Tile> | null => {
    if (!plan || !data) return null;
    if (view.kind === "plan") {
      const result = planResult(plan, data);
      return Object.fromEntries(CHIPS.map((c) => [c, tileFor(chipStatus(c, gw, result))])) as Record<
        ChipName,
        Tile
      >;
    }
    if (view.kind === "past" && chipsUsed) {
      const rules = engineContext(data).rules;
      const before = chipsUsed.filter((u) => u.gw < gw);
      const played = chipsUsed.find((u) => u.gw === gw)?.name;
      return Object.fromEntries(
        CHIPS.map((c): [ChipName, Tile] => {
          if (c === played) return [c, { state: "played", detail: "Played", disabled: true }];
          const use =
            chipAvailability(c, gw, before, rules) === "used" && before.findLast((u) => u.name === c);
          return [c, { state: "used", detail: use ? `Used GW${use.gw}` : "Not played", disabled: true }];
        }),
      ) as Record<ChipName, Tile>;
    }
    return null;
  }, [view.kind, plan, data, gw, chipsUsed]);

  if (!tiles) return null;

  return (
    <div role="group" aria-label="Chips" className="grid grid-cols-4 gap-2">
      {CHIPS.map((c) => (
        <ChipTile
          key={c}
          data-chip={c}
          label={CHIP_SHORT[c]}
          title={tiles[c].state === "planned" ? `Move ${CHIP_NAMES[c]} to GW${gw}` : CHIP_NAMES[c]}
          state={tiles[c].state}
          detail={tiles[c].detail}
          disabled={tiles[c].disabled ?? tiles[c].state === "used"}
          onClick={() => toggleChip(c)}
        />
      ))}
    </div>
  );
}
