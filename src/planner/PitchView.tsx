"use client";

import { memo, useCallback, useEffect, useMemo } from "react";
import { Bench } from "@/components/pitch/Bench";
import { Pitch, PitchRow } from "@/components/pitch/Pitch";
import { PlayerToken, type PlayerTokenProps } from "@/components/pitch/PlayerToken";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillButton } from "@/components/ui/PillButton";
import type { GameData } from "@/data/model";
import { canSwap, formationRows } from "@/engine/squad";
import { isEmptySlot, STARTERS } from "@/engine/types";
import { PlannerSkeleton } from "./PlannerSkeleton";
import { ProjectedPoints } from "./ProjectedPoints";
import { useGwView } from "./hooks";
import { metricPills, pastPills, photoUrl, type Metric } from "./metrics";
import type { FixturePoints } from "@/lib/fpl/types";
import { engineContext, playerFlag } from "./model";
import { loadPast, tapPlayer, usePlanner, type PastState } from "./store";

type Role = "C" | "V" | undefined;

const NO_KIT: PlayerTokenProps["kit"] = { style: "plain", primary: "#666", secondary: "#fff", gk: "#666" };

function tokenProps(
  data: GameData,
  id: number,
  gw: number,
  role: Role,
  metric: Metric,
  photos: boolean,
  /** Past gameweeks: what the player scored, which replaces the metric. */
  scored: FixturePoints[] | undefined,
): Omit<PlayerTokenProps, "onClick"> {
  if (isEmptySlot(id)) {
    const pos = data.playerById.get(-id)?.pos ?? "MID";
    return {
      name: "Empty",
      kit: NO_KIT,
      metrics: [{ label: pos, difficulty: null }],
      empty: true,
      captain: role,
    };
  }
  const player = data.playerById.get(id);
  const team = player && data.teamById.get(player.team);
  if (!player || !team) return { name: "Unknown", kit: NO_KIT, metrics: [] };
  const { pills, blank } = scored ? pastPills(data, player, scored) : metricPills(data, player, gw, metric);
  return {
    name: player.name,
    kit: team.kit,
    goalkeeper: player.pos === "GKP",
    metrics: pills,
    blank,
    photo: photos ? photoUrl(player) : undefined,
    captain: role,
    flag: playerFlag(player),
  };
}

const NO_POINTS: FixturePoints[] = [];

/**
 * A player's points in a gameweek, or undefined for a planned one (which
 * shows the chosen metric). A past gameweek never shows the metric: a player
 * whose points aren't there (yet) gets a dash.
 */
function scoredIn(past: PastState | undefined, id: number, isPast: boolean): FixturePoints[] | undefined {
  if (!isPast) return undefined;
  return (typeof past === "object" && past.playerPoints?.[id]) || NO_POINTS;
}

/** One player on the pitch. Memoised on primitives, so an edit re-renders only the slots it touches. */
const PitchPlayer = memo(function PitchPlayer({
  id,
  gw,
  role,
  selected,
  dimmed,
  lifted,
  targeted,
}: {
  id: number;
  gw: number;
  role: Role;
  selected: boolean;
  dimmed: boolean;
  lifted: boolean;
  targeted: boolean;
}) {
  const data = usePlanner((s) => s.data)!;
  const metric = usePlanner((s) => s.metric);
  const photos = usePlanner((s) => s.photos);
  const scored = usePlanner((s) => scoredIn(s.past[gw], id, !!s.team && gw < s.team.planFromGw));
  const props = useMemo(
    () => tokenProps(data, id, gw, role, metric, photos, scored),
    [data, id, gw, role, metric, photos, scored],
  );
  const onClick = useCallback(() => tapPlayer(id), [id]);
  return (
    <PlayerToken
      {...props}
      playerId={id}
      selected={selected}
      dimmed={dimmed}
      lifted={lifted}
      targeted={targeted}
      onClick={onClick}
    />
  );
});

/** Pointer handlers for the swipe area; they come from ./gestures once it has loaded. */
export interface PitchGestures {
  onPointerDown(e: React.PointerEvent<HTMLElement>): void;
  onPointerMove(e: React.PointerEvent): void;
  onPointerUp(e: React.PointerEvent): void;
  onPointerCancel(e: React.PointerEvent): void;
  onClickCapture(e: React.MouseEvent): void;
}

let gestureModule: typeof import("./gestures") | null = null;
const loadGestures = () =>
  import("./gestures").then(
    (m) => void (gestureModule = m),
    () => {},
  );

/** Forwards to the gesture handlers. A press before they arrive (a few ms after hydration) is a plain tap. */
const gestures: PitchGestures = {
  onPointerDown: (e) => gestureModule?.handlers.onPointerDown(e),
  onPointerMove: (e) => gestureModule?.handlers.onPointerMove(e),
  onPointerUp: (e) => gestureModule?.handlers.onPointerUp(e),
  onPointerCancel: (e) => gestureModule?.handlers.onPointerCancel(e),
  onClickCapture: (e) => gestureModule?.handlers.onClickCapture(e),
};

const attachGhost = (el: HTMLDivElement | null) => gestureModule?.attachGhost(el);

/** The copy of the dragged player that follows the finger. */
function DragGhost({ id, gw, role }: { id: number; gw: number; role: Role }) {
  const data = usePlanner((s) => s.data)!;
  const metric = usePlanner((s) => s.metric);
  const photos = usePlanner((s) => s.photos);
  const scored = usePlanner((s) => scoredIn(s.past[gw], id, !!s.team && gw < s.team.planFromGw));
  const props = useMemo(
    () => tokenProps(data, id, gw, role, metric, photos, scored),
    [data, id, gw, role, metric, photos, scored],
  );
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50 drop-shadow-[0_10px_18px_rgb(0_0_0/0.5)]"
      ref={attachGhost}
    >
      <PlayerToken {...props} selected />
    </div>
  );
}

export function PitchView() {
  const view = useGwView();
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  const mode = usePlanner((s) => s.mode);
  const selected = usePlanner((s) => s.selected);
  const dragFrom = usePlanner((s) => s.dragFrom);
  const dragOver = usePlanner((s) => s.dragOver);
  useEffect(() => void loadGestures(), []);
  const planSlots = view.kind === "plan" ? view.state.slots : null;

  // While a player is picked (sub mode) or dragged, only legal swap partners stay bright.
  const source = dragFrom ?? (mode === "sub" ? selected : null);
  const targets = useMemo(() => {
    if (source === null || !planSlots || !data) return null;
    const ctx = engineContext(data);
    return new Set(planSlots.filter((id) => canSwap(planSlots, source, id, ctx.position, ctx.rules)));
  }, [source, planSlots, data]);

  if (!data) return null;
  let squad: { slots: number[]; captain: number; vice: number } | null = null;
  if (view.kind === "plan") squad = view.state;
  else if (view.kind === "past" && view.picks && typeof view.picks === "object") squad = view.picks;

  // One element for every state, so a swipe can slide the pitch out and the next gameweek in
  // even while that gameweek is still loading.
  // The clip reaches into the page gutter, so the pitch slides off at the screen's edge. (Clipping
  // the body instead lets mobile browsers widen the page to fit it, losing the scroll position.)
  const swipeArea = (content: React.ReactNode) => (
    <div className="-mx-4 overflow-x-clip px-4">
      <div className="flex touch-pan-y flex-col gap-3" {...gestures}>
        {content}
      </div>
    </div>
  );

  if (view.kind === "past" && view.picks === "error") {
    return swipeArea(
      <GlassPanel className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-muted">Couldn’t load your team for GW{gw}.</p>
        <PillButton size="sm" onClick={() => void loadPast(gw)}>
          Try again
        </PillButton>
      </GlassPanel>,
    );
  }
  if (!squad) return swipeArea(<PlannerSkeleton />);

  const { slots, captain, vice } = squad;
  const role = (id: number): Role => (id === captain ? "C" : id === vice ? "V" : undefined);
  const rows = formationRows(slots, engineContext(data).position);
  const player = (id: number, withRole: boolean) => (
    <PitchPlayer
      key={id}
      id={id}
      gw={gw}
      role={withRole ? role(id) : undefined}
      selected={dragFrom === null && selected === id}
      dimmed={targets !== null && id !== source && !targets.has(id)}
      lifted={dragFrom === id}
      targeted={dragOver === id && !!targets?.has(id)}
    />
  );

  return swipeArea(
    <>
      <Pitch
        mode={
          view.kind !== "plan"
            ? null
            : mode === "transfer"
              ? "transfer"
              : mode === "sub" || dragFrom !== null // a drag is a sub too
                ? "sub"
                : null
        }
        corner={view.kind === "plan" ? <ProjectedPoints state={view.state} /> : undefined}
      >
        {rows.map((row, i) => (
          <PitchRow key={i}>{row.map((id) => player(id, true))}</PitchRow>
        ))}
      </Pitch>
      <Bench>{slots.slice(STARTERS).map((id) => player(id, false))}</Bench>
      {dragFrom !== null && (
        <DragGhost
          id={dragFrom}
          gw={gw}
          role={slots.indexOf(dragFrom) < STARTERS ? role(dragFrom) : undefined}
        />
      )}
    </>,
  );
}
