"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PillButton } from "@/components/ui/PillButton";
import type { GameData } from "@/data/model";
import { isEmptySlot, STARTERS, type GwState } from "@/engine/types";
import { useGwView } from "./hooks";
import { closeGuide, usePlanner } from "./store";

/*
 * "Get to know your planner": a spotlight tour of the real screen, shown the
 * first time the planner appears on a device (and from the account menu).
 * It teaches the moves nobody finds by themselves (holding to drag, swiping
 * the pitch) with a finger that acts them out on the real pitch. Nothing
 * behind it can be touched while it's open, so it never edits the plan.
 */

type Demo = "tap" | "drag" | "swipe";

/** The players the finger acts on: tap the captain, drag a sub onto a starter. */
interface Cast {
  captain: number;
  from: number;
  to: number;
}

interface Step {
  kicker?: string;
  title: string;
  body: string;
  /** What to light up (as one box), or nothing for a card over the dimmed screen. */
  targets?: (cast: Cast) => string[];
  demo?: Demo;
  next?: string;
}

const PITCH = '[data-guide="pitch"]';
const token = (id: number) => `${PITCH} [data-id="${id}"]`;

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Get to know your planner",
    body: "A few quick tips on the moves that aren’t obvious at first, like dragging and swiping. It takes about 30 seconds.",
    next: "Show me",
  },
  {
    title: "Tap a player",
    body: "See their stats and fixtures, make them captain, or sub or transfer them out. Tap an empty slot to buy a player.",
    targets: (c) => [token(c.captain)],
    demo: "tap",
  },
  {
    title: "Hold and drag to sub",
    body: "Press and hold a player until they lift, then drop them on a teammate to swap them. It works between the pitch and the bench.",
    targets: (c) => [token(c.from), token(c.to)],
    demo: "drag",
  },
  {
    title: "Swipe between gameweeks",
    body: "Swipe the pitch left or right to plan the gameweeks ahead, or look back at how past ones went. Prev and Next do the same.",
    targets: () => [`${PITCH} > :first-child`],
    demo: "swipe",
  },
  {
    title: "Prefer tapping?",
    body: "Turn on Sub, then tap two players to swap them. Turn on Transfer, then tap a player to pick their replacement.",
    targets: () => ['[data-guide="modes"]'],
  },
  {
    title: "Share your plan",
    body: "Turn your lineup into an image to post or send to your mini-league. You can replay this guide from the account menu.",
    targets: () => ['[data-guide="share"]'],
    next: "Done",
  },
];

/** Space kept round a lit-up element, and between it and the header or card. */
const PAD = 8;
const GAP = 12;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}
interface Point {
  x: number;
  y: number;
}

function union(els: Element[]): Box {
  const rects = els.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top };
}

/** The middle of a player's shirt, where a finger would press. */
function shirt(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + Math.min(20, r.height / 2) };
}

function fingerPath(demo: Demo, els: Element[], box: Box): { a: Point; b?: Point } {
  if (demo === "tap") return { a: shirt(els[0]) };
  if (demo === "drag") return { a: shirt(els[0]), b: shirt(els[1]) };
  const y = box.top + box.height * 0.42;
  return { a: { x: box.left + box.width * 0.72, y }, b: { x: box.left + box.width * 0.28, y } };
}

/** A bench outfielder and a starter in the same position, for the drag; the captain for the tap. */
function castFor(state: GwState | null, data: GameData | null): Cast | null {
  if (!state || !data) return null;
  const pos = (id: number) => data.playerById.get(Math.abs(id))?.pos;
  const bench = state.slots.slice(STARTERS);
  const from =
    bench.find((id) => !isEmptySlot(id) && pos(id) !== "GKP") ?? state.slots[STARTERS + 1] ?? bench[0];
  const same = state.slots.slice(1, STARTERS).filter((id) => pos(id) === pos(from));
  return { captain: state.captain, from, to: same.at(-1) ?? state.slots[STARTERS - 1] };
}

export function PlannerGuide() {
  const view = useGwView();
  const data = usePlanner((s) => s.data);
  const planState = view.kind === "plan" ? view.state : null;
  const cast = useMemo(() => castFor(planState, data), [planState, data]);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [finger, setFinger] = useState<{ demo: Demo; a: Point; b?: Point } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const go = (delta: number) => {
    const to = index + delta;
    if (to >= STEPS.length) closeGuide();
    else if (to >= 0) setIndex(to);
  };

  // The page stays put behind the guide (only the guide scrolls it), and out of reach of
  // focus and screen readers.
  useEffect(() => {
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    const behind = [...document.body.children].filter(
      (el) => el !== root.current && !el.hasAttribute("inert"),
    );
    behind.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      html.style.overflow = overflow;
      behind.forEach((el) => el.removeAttribute("inert"));
    };
  }, []);

  // Escape skips; the arrows step (and stay away from the planner's gameweek shortcuts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGuide();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

  useEffect(() => nextButton.current?.focus(), [index]);

  // Scroll the step's target into the space between the header and the card, then light it up.
  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const place = () => {
      const selectors = cast && step.targets ? step.targets(cast) : [];
      const els = selectors.map((s) => document.querySelector(s));
      if (!selectors.length || !els.every(Boolean)) {
        setSpot(null);
        setFinger(null);
        // Still arriving (the pitch is a moment behind the guide): look again shortly.
        if (step.targets && tries++ < 30) timer = setTimeout(place, 100);
        return;
      }
      const found = els as Element[];
      const top = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + GAP;
      const bottom = (dock.current?.getBoundingClientRect().top ?? window.innerHeight) - GAP;
      let box = union(found);
      const height = box.height + 2 * PAD;
      const want = height <= bottom - top ? top + (bottom - top - height) / 2 : top;
      window.scrollBy({ top: box.top - PAD - want, behavior: "instant" });
      box = union(found);
      setSpot({
        top: box.top - PAD,
        left: box.left - PAD,
        width: box.width + 2 * PAD,
        height: box.height + 2 * PAD,
      });
      setFinger(step.demo ? { demo: step.demo, ...fingerPath(step.demo, found, box) } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", place);
    };
  }, [step, cast]);

  return createPortal(
    <div ref={root} className="fade-in fixed inset-0 z-50 touch-none" data-testid="planner-guide">
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-[20px] transition-all duration-300 ease-out"
        style={
          spot
            ? {
                ...spot,
                boxShadow:
                  "0 0 0 2px color-mix(in srgb, var(--mint) 70%, transparent), 0 0 0 200vmax rgb(0 0 0 / 0.68)",
              }
            : { top: "50%", left: "50%", width: 0, height: 0, boxShadow: "0 0 0 200vmax rgb(0 0 0 / 0.68)" }
        }
      />
      {finger && <Finger key={`${index}`} {...finger} />}
      <div
        ref={dock}
        className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          aria-describedby="guide-body"
          className="glass-strong sheet-in pointer-events-auto flex w-full max-w-md flex-col gap-1.5 rounded-3xl p-5"
          style={{ background: "linear-gradient(var(--glass-solid), var(--glass-solid)), var(--bg)" }}
        >
          <div aria-live="polite">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-mint uppercase">
              {step.kicker ?? `Tip ${index} of ${STEPS.length - 1}`}
            </p>
            <h2 id="guide-title" className="mt-1.5 font-display text-lg font-bold">
              {step.title}
            </h2>
            <p id="guide-body" className="mt-1 text-sm text-muted">
              {step.body}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div aria-hidden className="flex flex-1 items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-4 bg-mint" : "w-1.5 bg-fg/25"}`}
                />
              ))}
            </div>
            {!last && (
              <button
                type="button"
                className="h-9 px-2 text-[13px] font-semibold text-muted hover:text-fg"
                onClick={closeGuide}
              >
                Skip
              </button>
            )}
            {index > 0 && (
              <PillButton size="sm" onClick={() => go(-1)}>
                Back
              </PillButton>
            )}
            <PillButton ref={nextButton} variant="neon" size="sm" onClick={() => go(1)}>
              {step.next ?? "Next"}
            </PillButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const at = (p: Point, scale = 1) => `translate(${p.x}px, ${p.y}px) scale(${scale})`;
const MOVE = "cubic-bezier(0.45, 0, 0.25, 1)";

/**
 * A fingertip acting out the step's gesture, on a loop: a tap (with a ripple),
 * a press-and-hold that lifts and carries to another player, or a sideways
 * swipe. With reduced motion it just rests where the gesture starts.
 */
function Finger({ demo, a, b = a }: { demo: Demo; a: Point; b?: Point }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dotFrames: Keyframe[];
    let ringFrames: Keyframe[];
    let duration: number;
    if (demo === "tap") {
      duration = 1600;
      dotFrames = [
        { offset: 0, transform: at(a, 1.3), opacity: 0 },
        { offset: 0.15, transform: at(a), opacity: 1 },
        { offset: 0.3, transform: at(a, 0.8), opacity: 1 },
        { offset: 0.42, transform: at(a), opacity: 1 },
        { offset: 0.75, transform: at(a), opacity: 1 },
        { offset: 1, transform: at(a), opacity: 0 },
      ];
      ringFrames = [
        { offset: 0, transform: at(a, 0.6), opacity: 0 },
        { offset: 0.3, transform: at(a, 0.6), opacity: 0.9 },
        { offset: 0.75, transform: at(a, 1.9), opacity: 0 },
        { offset: 1, transform: at(a, 1.9), opacity: 0 },
      ];
    } else if (demo === "drag") {
      // Press, hold while the ring fills (the player lifts), carry, let go.
      duration = 3000;
      dotFrames = [
        { offset: 0, transform: at(a, 1.3), opacity: 0 },
        { offset: 0.1, transform: at(a), opacity: 1 },
        { offset: 0.18, transform: at(a, 0.8), opacity: 1 },
        { offset: 0.34, transform: at(a, 0.8), opacity: 1, easing: MOVE },
        { offset: 0.72, transform: at(b, 0.8), opacity: 1 },
        { offset: 0.8, transform: at(b), opacity: 1 },
        { offset: 0.9, transform: at(b), opacity: 1 },
        { offset: 1, transform: at(b), opacity: 0 },
      ];
      ringFrames = [
        { offset: 0, transform: at(a, 0.6), opacity: 0 },
        { offset: 0.18, transform: at(a, 0.6), opacity: 0 },
        { offset: 0.34, transform: at(a, 1.15), opacity: 1, easing: MOVE },
        { offset: 0.72, transform: at(b, 1.15), opacity: 1 },
        { offset: 0.8, transform: at(b, 1.6), opacity: 0 },
        { offset: 1, transform: at(b, 1.6), opacity: 0 },
      ];
    } else {
      duration = 2000;
      dotFrames = [
        { offset: 0, transform: at(a, 1.3), opacity: 0 },
        { offset: 0.15, transform: at(a), opacity: 1, easing: MOVE },
        { offset: 0.6, transform: at(b), opacity: 1 },
        { offset: 0.75, transform: at(b), opacity: 0 },
        { offset: 1, transform: at(b), opacity: 0 },
      ];
      ringFrames = [{ opacity: 0 }, { opacity: 0 }];
    }
    const options = { duration, iterations: Infinity };
    const running = [dot.current!.animate(dotFrames, options), ring.current!.animate(ringFrames, options)];
    return () => running.forEach((r) => r.cancel());
  }, [demo, a, b]);

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 -mt-7 -ml-7 size-14 rounded-full border-2 border-mint"
        style={{ transform: at(a), opacity: 0 }}
      />
      <div
        ref={dot}
        aria-hidden
        data-testid="guide-finger"
        className="pointer-events-none fixed top-0 left-0 -mt-5 -ml-5 size-10 rounded-full border-2 border-white bg-white/70 shadow-[0_4px_16px_rgb(0_0_0/0.5)]"
        style={{ transform: at(a) }}
      />
    </>
  );
}
