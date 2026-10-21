"use client";

import { useState } from "react";
import type { ChipName } from "@/config/rules";
import { CaptainBadge } from "@/components/ui/Badges";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Close, Swap, Transfer } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import type { GameData } from "@/data/model";
import type { Move } from "@/engine/types";
import { useGwView } from "./hooks";
import { formatPrice } from "./model";
import { removeMoveAt, resetCurrentGw, setTransferPrice, usePlanner } from "./store";

const CHIP_NAMES: Record<ChipName, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

/** A short, plain description of a move, used for the row and the "Removed: …" toast. */
export function describeMove(data: GameData, move: Move): string {
  const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
  switch (move.type) {
    case "transfer":
      return `${name(move.out)} → ${name(move.in)}`;
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

/** "6.2", "£6.2m" → 62 tenths; null when it isn't a sensible player price. */
function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[£ms]/gi, ""));
  const tenths = Math.round(n * 10);
  return text.trim() !== "" && Number.isFinite(n) && tenths >= 10 && tenths <= 300 ? tenths : null;
}

/**
 * A transfer's sale or purchase price, tap to edit: for transfers already made
 * at a price that has since changed. Clearing the field goes back to the
 * calculated price.
 */
function PriceField({
  label,
  value,
  edited,
  onChange,
}: {
  label: string;
  value: number;
  edited: boolean;
  onChange: (price: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={`${label} ${formatPrice(value)}${edited ? " (edited)" : ""}, edit`}
        title={edited ? "Edited by you. Clear the field to use the calculated price." : "Edit price"}
        onClick={() => setDraft((value / 10).toFixed(1))}
        className={`rounded-md px-1 tabular-nums underline decoration-dotted underline-offset-2 hover:text-fg ${edited ? "text-violet" : ""}`}
      >
        {formatPrice(value)}
      </button>
    );
  }

  const commit = () => {
    if (draft.trim() === "") onChange(undefined);
    else {
      const price = parsePrice(draft);
      if (price !== null && price !== value) onChange(price);
    }
    setDraft(null);
  };
  return (
    <input
      autoFocus
      inputMode="decimal"
      aria-label={label}
      placeholder="calc."
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-6 w-14 rounded-md border border-[var(--line)] bg-[var(--glass-solid)] px-1.5 text-xs text-fg tabular-nums outline-none focus:border-mint"
    />
  );
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
              // Prices only for a player actually sold and one actually bought (not a chain's middle).
              const priced =
                move.type === "transfer" &&
                !problem &&
                state.sold.includes(move.out) &&
                state.bought.includes(move.in)
                  ? move
                  : null;
              const name = (id: number) => data.playerById.get(id)?.name ?? "Unknown";
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
                    {priced && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        Sold
                        <PriceField
                          label={`${name(priced.out)} sold for`}
                          value={state.soldFor[priced.out]}
                          edited={priced.sellPrice !== undefined}
                          onChange={(price) => setTransferPrice(index, "sell", price)}
                        />
                        · Bought
                        <PriceField
                          label={`${name(priced.in)} bought for`}
                          value={state.purchase[priced.in]}
                          edited={priced.buyPrice !== undefined}
                          onChange={(price) => setTransferPrice(index, "buy", price)}
                        />
                      </span>
                    )}
                  </span>
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
