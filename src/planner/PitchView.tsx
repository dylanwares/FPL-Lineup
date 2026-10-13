"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import { Bench } from "@/components/pitch/Bench";
import { Pitch, PitchRow } from "@/components/pitch/Pitch";
import { PlayerToken, type PlayerTokenProps } from "@/components/pitch/PlayerToken";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillButton } from "@/components/ui/PillButton";
import type { GameData } from "@/data/model";
import { formationRows } from "@/engine/squad";
import { STARTERS } from "@/engine/types";
import { PlannerSkeleton } from "./PlannerSkeleton";
import { useGwView } from "./hooks";
import { engineContext, fixtureMetrics, playerFlag } from "./model";
import { loadPast, openSheet, stepGw, usePlanner } from "./store";

type Role = "C" | "V" | undefined;

function tokenProps(data: GameData, id: number, gw: number, role: Role): Omit<PlayerTokenProps, "onClick"> {
  const player = data.playerById.get(id);
  const team = player && data.teamById.get(player.team);
  if (!player || !team)
    return {
      name: "Unknown",
      kit: { style: "plain", primary: "#666", secondary: "#fff", gk: "#666" },
      metrics: [],
    };
  return {
    name: player.name,
    kit: team.kit,
    goalkeeper: player.pos === "GKP",
    metrics: fixtureMetrics(data, player.team, gw),
    captain: role,
    flag: playerFlag(player),
  };
}

/** One player on the pitch. Memoised on primitives, so an edit re-renders only the slots it touches. */
const PitchPlayer = memo(function PitchPlayer({ id, gw, role }: { id: number; gw: number; role: Role }) {
  const data = usePlanner((s) => s.data)!;
  const props = useMemo(() => tokenProps(data, id, gw, role), [data, id, gw, role]);
  const onClick = useCallback(() => openSheet(id), [id]);
  return <PlayerToken {...props} onClick={onClick} />;
});

/** Horizontal swipe on the pitch changes gameweek; vertical scrolling is untouched. */
function useSwipe() {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
      swiped.current = false;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
        swiped.current = true;
        stepGw(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
    // A swipe that ends on a player shouldn't also open their sheet.
    onClickCapture: (e: React.MouseEvent) => {
      if (swiped.current) {
        e.stopPropagation();
        swiped.current = false;
      }
    },
  };
}

export function PitchView() {
  const view = useGwView();
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  const swipe = useSwipe();

  if (!data) return null;
  let squad: { slots: number[]; captain: number; vice: number } | null = null;
  if (view.kind === "plan") squad = view.state;
  else if (view.kind === "past" && view.picks && typeof view.picks === "object") squad = view.picks;

  if (view.kind === "past" && view.picks === "error") {
    return (
      <GlassPanel className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-muted">Couldn’t load your team for GW{gw}.</p>
        <PillButton size="sm" onClick={() => void loadPast(gw)}>
          Try again
        </PillButton>
      </GlassPanel>
    );
  }
  if (!squad) return <PlannerSkeleton />;

  const { slots, captain, vice } = squad;
  const role = (id: number): Role => (id === captain ? "C" : id === vice ? "V" : undefined);
  const rows = formationRows(slots, engineContext(data).position);

  return (
    <div className="flex touch-pan-y flex-col gap-3" {...swipe}>
      <Pitch>
        {rows.map((row, i) => (
          <PitchRow key={i}>
            {row.map((id) => (
              <PitchPlayer key={id} id={id} gw={gw} role={role(id)} />
            ))}
          </PitchRow>
        ))}
      </Pitch>
      <Bench>
        {slots.slice(STARTERS).map((id) => (
          <PitchPlayer key={id} id={id} gw={gw} role={undefined} />
        ))}
      </Bench>
    </div>
  );
}
