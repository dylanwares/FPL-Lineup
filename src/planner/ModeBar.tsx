"use client";

import { Swap, Transfer } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { playerList } from "./lazy-parts";
import { toggleMode, usePlanner } from "./store";

// Transfer mode needs the player list: make sure it's loaded before the first tap.
const preloadPlayerList = () => playerList.preload().catch(() => {});

/** Sub and Transfer toggles under the bench, and the hint for the current mode. */
export function ModeBar() {
  const mode = usePlanner((s) => s.mode);
  const selected = usePlanner((s) => s.selected);
  const readOnly = usePlanner((s) => !s.team || s.gw < s.team.planFromGw);

  let hint: string | null = null;
  if (mode === "sub")
    hint =
      selected === null ? "Tap a player to move" : "Tap a highlighted player to swap, or tap again to cancel";
  if (mode === "transfer") hint = "Tap a player to replace";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2" data-guide="modes">
        <PillButton
          className="justify-center"
          pressed={mode === "sub"}
          disabled={readOnly}
          onClick={() => toggleMode("sub")}
        >
          <Swap />
          Sub
        </PillButton>
        <PillButton
          className="justify-center"
          pressed={mode === "transfer"}
          disabled={readOnly}
          onPointerEnter={() => void preloadPlayerList()}
          onClick={() => {
            void preloadPlayerList();
            toggleMode("transfer");
          }}
        >
          <Transfer />
          Transfer
        </PillButton>
      </div>
      {hint && (
        <p className="px-1 text-xs text-muted" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
