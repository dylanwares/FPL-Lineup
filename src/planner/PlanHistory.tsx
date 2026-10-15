"use client";

import { CaptainBadge } from "@/components/ui/Badges";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Close, Swap, Transfer, Trash } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import type { GameData } from "@/data/model";
import { isEmptySlot, type Move } from "@/engine/types";
import { useGwView } from "./hooks";
import { CHIP_NAMES, formatPrice } from "./model";
import { removeMoveAt, resetCurrentGw, usePlanner } from "./store";

/** A short, plain description of a move, used for the row and the "Removed: …" toast. */
export function describeMove(data: GameData, move: Move): string {
  const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
  switch (move.type) {
    case "transfer":
      return isEmptySlot(move.out) ? `${name(move.in)} bought` : `${name(move.out)} → ${name(move.in)}`;
    case "remove":
      return `${name(move.player)} removed`;
    case "sub":
      return `${name(move.a)} ⇄ ${name(move.b)}`;
    case "captain":
      return `${name(move.player)} made captain`;
    case "vice":
      return `${name(move.player)} made vice-captain`;
    case "chip":
      return move.chip ? `${CHIP_NAMES[move.chip]} played` : "Chip cancelled";
  }
}

function MoveIcon({ move }: { move: Move }) {
  const box = "grid size-7 shrink-0 place-items-center rounded-lg";
  switch (move.type) {
    case "transfer":
      return (
        <span className={`${box} bg-violet/15 text-violet`}>
          <Transfer className="size-3.5" />
        </span>
      );
    case "remove":
      return (
        <span className={`${box} bg-magenta/15 text-magenta`}>
          <Trash className="size-3.5" />
        </span>
      );
    case "sub":
      return (
        <span className={`${box} bg-mint/15 text-mint`}>
          <Swap className="size-3.5" />
        </span>
      );
    case "captain":
    case "vice":
      return (
        <span className={box}>
          <CaptainBadge role={move.type === "captain" ? "C" : "V"} />
        </span>
      );
    case "chip":
      return (
        <span className={`${box} bg-magenta/15 text-[10px] font-bold text-magenta`}>
          {move.chip
            ? CHIP_NAMES[move.chip]
                .split(" ")
                .map((w) => w[0])
                .join("")
            : "–"}
        </span>
      );
  }
}

/** The changes planned for the gameweek on screen, in the order they were made. */
export function PlanHistory() {
  const view = useGwView();
  const plan = usePlanner((s) => s.plan);
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  if (view.kind !== "plan" || !plan || !data) return null;

  const state = view.state;
  // Keep each move's position in the whole log, so × removes exactly that one.
  const rows = plan.moves.map((move, index) => ({ move, index })).filter((r) => r.move.gw === gw);
  const problems = new Map(
    state.warnings.flatMap((w) => (w.kind === "invalid-move" ? [[w.move, w.reason] as const] : [])),
  );

  return (
    <GlassPanel as="section" aria-labelledby="history-title" className="px-4 pt-3 pb-3.5">
      <header className="flex min-h-9 items-center justify-between gap-3">
        <h2 id="history-title" className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">
          History · GW{gw}
        </h2>
        {rows.length > 0 && (
          <PillButton size="sm" onClick={resetCurrentGw}>
            Reset GW{gw}
          </PillButton>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="pt-1 text-sm text-muted">
          No changes planned for GW{gw} yet. Use Sub or Transfer, or tap a player.
        </p>
      ) : (
        <>
          <ol className="mt-1 flex flex-col">
            {rows.map(({ move, index }, i) => {
              const problem = problems.get(move);
              const label = describeMove(data, move);
              const price = move.type === "transfer" ? data.playerById.get(move.in)?.price : undefined;
              return (
                <li
                  key={index}
                  className="flex items-center gap-3 border-b border-[var(--line)] py-2 last:border-b-0"
                >
                  <span className="w-4 shrink-0 text-right text-[11px] text-faint tabular-nums">{i + 1}</span>
                  <MoveIcon move={move} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${problem ? "text-muted line-through" : ""}`}>
                      {label}
                    </span>
                    {problem && (
                      <span className="block text-[11px] text-magenta">Not applied: {problem}</span>
                    )}
                  </span>
                  {price !== undefined && !problem && (
                    <span className="shrink-0 text-xs text-muted tabular-nums">{formatPrice(price)}</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove: ${label}`}
                    onClick={() => removeMoveAt(index, label)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-[var(--line)] hover:text-fg"
                  >
                    <Close className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-muted">
            {state.chip && `${CHIP_NAMES[state.chip]} · `}
            {state.transfers} transfer{state.transfers === 1 ? "" : "s"}
            {" · "}
            {state.cost ? <span className="text-magenta">-{state.cost} pts hit</span> : "no points hit"}
          </p>
        </>
      )}
    </GlassPanel>
  );
}
