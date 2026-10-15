"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
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
import {
  canDrag,
  canStepGw,
  cancelDrag,
  endDrag,
  loadPast,
  setDragOver,
  startDrag,
  stepGw,
  tapPlayer,
  usePlanner,
  type PastState,
} from "./store";

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

const HOLD_MS = 150; // press this long to pick a player up
const MOVE_TOLERANCE = 8; // px of movement that turns a press into a scroll or swipe
const GHOST_LIFT = 40; // px the dragged copy floats above the finger

/** Where the dragged copy should be; written by the gesture handler, read by DragGhost. */
const ghost = { el: null as HTMLDivElement | null, x: 0, y: 0, offsetX: 0, offsetY: 0 };

function placeGhost() {
  if (ghost.el) {
    ghost.el.style.transform = `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0) scale(1.08)`;
  }
}

/** Marks the player under the finger as the drop target. */
function hitTest() {
  const under = document.elementFromPoint(ghost.x, ghost.y)?.closest<HTMLElement>("[data-id]");
  setDragOver(under ? Number(under.dataset.id) : null);
}

const EDGE = 80; // px from the top (below the header) or bottom where dragging scrolls the page
const HEADER = 72;

/**
 * While a player is held near the top or bottom of the screen, scroll the page
 * (faster the closer to the edge), so the bench can be reached from the pitch
 * on a short phone. Runs once per frame until the drag ends.
 */
function autoScroll(isDragging: () => boolean) {
  const tick = () => {
    if (!isDragging()) return;
    const bottom = window.innerHeight - EDGE;
    const top = HEADER + EDGE;
    let dy = 0;
    if (ghost.y > bottom) dy = Math.min(20, 3 + (ghost.y - bottom) / 4);
    else if (ghost.y < top) dy = -Math.min(20, 3 + (top - ghost.y) / 4);
    if (dy) {
      window.scrollBy(0, dy);
      hitTest();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const SWIPE_COMMIT = 0.25; // of the pitch's width: let go past this to change gameweek
const FLICK = 0.4; // px/ms: a quick flick changes gameweek even if it's short
const FLICK_MIN = 30; // px: …but not a twitch
const SWIPE_OUT_MS = 140;
const SWIPE_IN_MS = 240;

/** The slide playing after a swipe, and whether a new press wants the rest of it skipped. */
let sliding: Animation | null = null;
let hurry = false;

/** A press while the pitch is still sliding jumps it to where it's going, so quick swipes chain. */
function hurrySwipe() {
  hurry = true;
  sliding?.finish();
}

/** The pitch `x` px from its place, fading as it goes, so the gameweek visibly changes. */
function swipeFrame(x: number, width: number): Keyframe {
  return {
    transform: `translate3d(${x}px, 0, 0)`,
    opacity: String(1 - Math.min(0.6, Math.abs(x) / width)),
  };
}

function placeSwipe(el: HTMLElement, x: number) {
  if (x === 0) {
    // No transform at rest: it would make the drag ghost's `fixed` position relative to the pitch.
    el.style.transform = "";
    el.style.opacity = "";
  } else Object.assign(el.style, swipeFrame(x, el.offsetWidth));
}

async function slideSwipe(el: HTMLElement, from: number, to: number, ms: number, easing: string) {
  placeSwipe(el, to);
  if (hurry || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const width = el.offsetWidth;
  sliding = el.animate([swipeFrame(from, width), swipeFrame(to, width)], { duration: ms, easing });
  await sliding.finished.catch(() => {});
  sliding = null;
}

/**
 * Lets go of a swipe. Past a quarter of the width (or on a flick) the pitch
 * slides off that side, the gameweek changes, and the next one slides in from
 * the other; otherwise it springs back.
 */
async function releaseSwipe(el: HTMLElement, dx: number, velocity: number) {
  const width = el.offsetWidth;
  const delta = dx < 0 ? 1 : -1; // swipe left for the next gameweek
  const far = Math.abs(dx) > width * SWIPE_COMMIT;
  const flick =
    Math.abs(dx) > FLICK_MIN && Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(dx);
  hurry = false;
  try {
    if (!canStepGw(delta) || !(far || flick)) {
      await slideSwipe(el, dx, 0, SWIPE_IN_MS, "cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    await slideSwipe(el, dx, -delta * width, SWIPE_OUT_MS, "ease-in");
    flushSync(() => stepGw(delta));
    await slideSwipe(el, delta * width, 0, SWIPE_IN_MS, "cubic-bezier(0.2, 0.8, 0.2, 1)");
  } finally {
    placeSwipe(el, 0);
  }
}

/**
 * Pointer gestures on the pitch and bench:
 * - press and hold a player, then drag onto another to sub them (planned gameweeks);
 * - swipe sideways to change gameweek: the pitch follows the finger, then
 *   slides out as the next gameweek slides in (or springs back);
 * - anything that moves early is left to the browser (scrolling).
 * Taps still reach the players as clicks.
 */
function usePitchGestures() {
  const g = useRef({
    pointerId: -1,
    x0: 0,
    y0: 0,
    timer: 0 as ReturnType<typeof setTimeout> | 0,
    dragging: false,
    swiping: false,
    el: null as HTMLElement | null,
    /** Latest pointer sample, for the release velocity. */
    lastX: 0,
    lastT: 0,
    vx: 0,
    suppressClick: false,
  });

  // Once a player is picked up, stop the page scrolling under the finger.
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (g.current.dragging) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  const clearHold = () => {
    if (g.current.timer) clearTimeout(g.current.timer);
    g.current.timer = 0;
  };

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      hurrySwipe();
      const s = g.current;
      clearHold();
      Object.assign(s, {
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        dragging: false,
        swiping: false,
        el: e.currentTarget,
        lastX: e.clientX,
        lastT: e.timeStamp,
        vx: 0,
      });
      ghost.x = e.clientX;
      ghost.y = e.clientY;
      const token = (e.target as Element).closest<HTMLElement>("[data-id]");
      if (!token || !canDrag()) return;
      const container = e.currentTarget;
      s.timer = setTimeout(() => {
        s.timer = 0;
        const rect = token.getBoundingClientRect();
        ghost.offsetX = s.x0 - rect.left;
        // Float the copy above the finger so the player being dropped on stays visible.
        ghost.offsetY = s.y0 - rect.top + GHOST_LIFT;
        s.dragging = true;
        try {
          container.setPointerCapture(s.pointerId);
        } catch {
          // The pointer may already be gone; the drag then ends on the next event.
        }
        startDrag(Number(token.dataset.id));
        navigator.vibrate?.(10);
        autoScroll(() => s.dragging);
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = g.current;
      if (e.pointerId !== s.pointerId) return;
      ghost.x = e.clientX;
      ghost.y = e.clientY;
      if (!s.dragging) {
        const dx = e.clientX - s.x0;
        const dy = e.clientY - s.y0;
        if (!s.swiping && Math.hypot(dx, dy) > MOVE_TOLERANCE) {
          clearHold();
          // Mostly sideways: a swipe. (Mostly up or down is the browser's scroll.)
          if (Math.abs(dx) > Math.abs(dy) * 1.5 && s.el) {
            s.swiping = true;
            try {
              s.el.setPointerCapture(s.pointerId);
            } catch {
              // The pointer may already be gone; the swipe then ends on the next event.
            }
          }
        }
        if (s.swiping && s.el) {
          const dt = e.timeStamp - s.lastT;
          if (dt > 0) s.vx = (e.clientX - s.lastX) / dt;
          s.lastX = e.clientX;
          s.lastT = e.timeStamp;
          // Heavy resistance past the first or last gameweek.
          placeSwipe(s.el, canStepGw(dx < 0 ? 1 : -1) ? dx : dx * 0.25);
        }
        return;
      }
      placeGhost();
      hitTest();
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = g.current;
      if (e.pointerId !== s.pointerId) return;
      s.pointerId = -1; // a mouse moving with no button down isn't a swipe
      clearHold();
      if (s.dragging) {
        s.dragging = false;
        s.suppressClick = true; // the release shouldn't also tap the player
        endDrag();
        return;
      }
      if (s.swiping && s.el) {
        s.swiping = false;
        s.suppressClick = true; // a swipe that ends on a player shouldn't open their sheet
        // A finger held still before letting go isn't a flick.
        const velocity = e.timeStamp - s.lastT > 80 ? 0 : s.vx;
        void releaseSwipe(s.el, e.clientX - s.x0, velocity);
      }
    },
    onPointerCancel: () => {
      clearHold();
      const s = g.current;
      s.pointerId = -1;
      if (s.swiping && s.el) {
        s.swiping = false;
        void releaseSwipe(s.el, 0, 0);
      }
      if (g.current.dragging) {
        g.current.dragging = false;
        cancelDrag();
      }
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (g.current.suppressClick) {
        e.stopPropagation();
        g.current.suppressClick = false;
      }
    },
  };
}

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
      ref={(el) => {
        ghost.el = el;
        placeGhost();
      }}
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
  const gestures = usePitchGestures();
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
