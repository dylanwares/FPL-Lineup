"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatTile } from "@/components/ui/StatTile";
import { FREE_TRANSFER_CHIPS } from "@/engine/money";
import { isEmptySlot } from "@/engine/types";
import { useGwView } from "./hooks";
import { formatPrice } from "./model";
import { usePlanner } from "./store";

/** Transfers (used / free), Bank and Cost for the gameweek on screen. */
export function StatsRow() {
  const view = useGwView();
  const gw = usePlanner((s) => s.gw);
  const history = usePlanner((s) => s.team?.history);
  const teamById = usePlanner((s) => s.data?.teamById);

  if (view.kind === "past") {
    const h = history?.find((x) => x.gw === gw);
    return (
      <GlassPanel className="grid grid-cols-3 divide-x divide-[var(--line)]">
        <StatTile label="Points" value={h ? h.points : "–"} />
        <StatTile label="Transfers" value={h ? h.transfers : "–"} />
        <StatTile label="Cost" value={h ? `${h.cost ? `-${h.cost}` : 0} pts` : "–"} />
      </GlassPanel>
    );
  }
  if (view.kind !== "plan") return null;

  const s = view.state;
  const free = FREE_TRANSFER_CHIPS.has(s.chip) ? "∞" : s.freeTransfers;
  const clubWarnings = s.warnings.filter((w) => w.kind === "club-limit");
  const limit = s.warnings.find((w) => w.kind === "transfer-limit");
  const empty = s.slots.filter(isEmptySlot).length;

  return (
    <div className="flex flex-col gap-1.5">
      <GlassPanel className="grid grid-cols-3 divide-x divide-[var(--line)]">
        <StatTile label="Transfers" value={`${s.transfers}/${free}`} />
        <StatTile label="Bank" value={formatPrice(s.bank)} tone={s.bank < 0 ? "danger" : "good"} />
        <StatTile
          label="Cost"
          value={s.cost ? `-${s.cost} pts` : "0 pts"}
          tone={s.cost ? "danger" : "default"}
        />
      </GlassPanel>
      {(s.bank < 0 || clubWarnings.length > 0 || limit || empty > 0) && (
        <ul role="alert" className="flex flex-col gap-0.5 px-1 text-xs text-magenta">
          {s.bank < 0 && <li>Over budget by {formatPrice(-s.bank)}</li>}
          {empty > 0 && (
            <li>
              {empty} empty slot{empty === 1 ? "" : "s"}: tap {empty === 1 ? "it" : "one"} to add a player
            </li>
          )}
          {limit && (
            <li>
              {limit.count} transfers: FPL allows {limit.max} a gameweek without a Wildcard or Free Hit
            </li>
          )}
          {clubWarnings.map((w) => (
            <li key={w.team}>
              {w.count} players from {teamById?.get(w.team)?.name ?? "one club"} (max 3)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
