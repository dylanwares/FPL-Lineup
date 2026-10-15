import { flushSync } from "react-dom";
import { canDrag, canStepGw, cancelDrag, endDrag, setDragOver, startDrag, stepGw } from "./store";
import type { PitchGestures } from "./PitchView";

/*
 * Pointer gestures on the pitch, loaded just after first paint (the pitch
 * passes events through once this module is here; taps never need it).
 */

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

/** Where the dragged copy is drawn; DragGhost hands over its element. */
export function attachGhost(el: HTMLDivElement | null) {
  ghost.el = el;
  placeGhost();
}

/** The press in progress. */
const g = {
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
};

// Once a player is picked up, stop the page scrolling under the finger.
document.addEventListener(
  "touchmove",
  (e) => {
    if (g.dragging) e.preventDefault();
  },
  { passive: false },
);

const clearHold = () => {
  if (g.timer) clearTimeout(g.timer);
  g.timer = 0;
};

/**
 * Pointer gestures on the pitch and bench:
 * - press and hold a player, then drag onto another to sub them (planned gameweeks);
 * - swipe sideways to change gameweek: the pitch follows the finger, then
 *   slides out as the next gameweek slides in (or springs back);
 * - anything that moves early is left to the browser (scrolling).
 * Taps still reach the players as clicks.
 */
export const handlers: PitchGestures = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    hurrySwipe();
    const s = g;
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
    const s = g;
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
    const s = g;
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
    const s = g;
    s.pointerId = -1;
    if (s.swiping && s.el) {
      s.swiping = false;
      void releaseSwipe(s.el, 0, 0);
    }
    if (g.dragging) {
      g.dragging = false;
      cancelDrag();
    }
  },
  onClickCapture: (e: React.MouseEvent) => {
    if (g.suppressClick) {
      e.stopPropagation();
      g.suppressClick = false;
    }
  },
};
