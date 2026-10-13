import type { ComponentPropsWithoutRef } from "react";

export type ChipState = "available" | "played" | "used";

const LOOK: Record<ChipState, string> = {
  available: "glass-pill chip-available text-fg",
  played: "accent-soft hot",
  used: "glass-pill text-muted opacity-50",
};

interface ChipTileProps extends ComponentPropsWithoutRef<"button"> {
  label: string;
  state: ChipState;
  /** Second line, e.g. "Available", "Played GW7", "Used GW3". */
  detail: string;
}

export function ChipTile({ label, state, detail, className = "", ...rest }: ChipTileProps) {
  return (
    <button
      type="button"
      aria-pressed={state === "played"}
      disabled={state === "used"}
      className={`${LOOK[state]} flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 ${className}`}
      {...rest}
    >
      <span className="w-full truncate text-center text-xs leading-tight font-semibold">{label}</span>
      <span className={`text-[10px] leading-tight ${state === "played" ? "opacity-80" : "text-muted"}`}>
        {detail}
      </span>
    </button>
  );
}
