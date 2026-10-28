"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pitch, PitchRow } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { Close } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { formationRows } from "@/engine/squad";
import { STARTERS } from "@/engine/types";
import { engineContext, formatPrice } from "./model";
import { tokenProps } from "./PitchView";
import type { TeamRating } from "./rating";
import { usePlanner } from "./store";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * The best XI the team rating measures against, on its own pitch with each
 * player's expected points. Portalled to the body, and pointer events stop
 * here, so the pitch behind can't be swiped (or its transform move this).
 */
export function BestXiSheet({
  rating,
  gw,
  slots,
  onClose,
}: {
  rating: TeamRating;
  gw: number;
  /** The planned squad, to count how many of the best XI you already start. */
  slots: number[];
  onClose: () => void;
}) {
  const data = usePlanner((s) => s.data)!;
  const photos = usePlanner((s) => s.photos);
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes; the planner's arrow-key shortcuts stay off while this is open.
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  const { rules, position } = engineContext(data);
  const { perfect } = rating;
  const mine = new Set(slots.slice(0, STARTERS));
  const shared = perfect.xi.filter((id) => mine.has(id)).length;
  const rows = formationRows(perfect.xi, position);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4"
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fade-in absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="best-xi-title"
        tabIndex={-1}
        className="glass-strong sheet-in relative flex max-h-[100dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="best-xi-title" className="font-display text-lg font-bold">
              Best XI · GW{gw}
            </h2>
            <p className="text-sm text-muted">
              The top {formatPrice(rules.squad.budget)} team, {rating.best.toFixed(1)} xP
            </p>
          </div>
          <PillButton size="icon" aria-label="Close" onClick={onClose}>
            <Close className="size-4" />
          </PillButton>
        </header>

        <Pitch>
          {rows.map((row, i) => (
            <PitchRow key={i}>
              {row.map((id) => (
                <PlayerToken
                  key={id}
                  {...tokenProps(data, id, gw, undefined, "xp", photos, undefined, undefined)}
                />
              ))}
            </PitchRow>
          ))}
        </Pitch>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Your XI" value={`${rating.mine.toFixed(1)} xP`} />
          <Stat label="In your XI" value={`${shared} of ${STARTERS}`} />
          <Stat label="Squad cost" value={formatPrice(perfect.cost)} />
        </dl>
        <p className="text-xs text-muted">
          Raw expected points, with no armband, chips or hits. The squad is completed by the cheapest legal
          bench.
        </p>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--line)] px-1 py-2">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
