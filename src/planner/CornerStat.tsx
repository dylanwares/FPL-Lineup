"use client";

import { useLayoutEffect, useRef } from "react";

const COUNT_MS = 600;
const FADE_MS = 700;

/**
 * A number that counts to each new value instead of jumping: from wherever
 * it is now (so a change mid-count carries on smoothly), easing out. It
 * appears at once when it first shows, and for people who prefer reduced
 * motion. While it counts it's tinted green for a rise and red for a fall,
 * fading back to normal after. It writes its text straight to the DOM, so a count doesn't
 * re-render anything sixty times a second.
 */
function CountUp({
  value,
  format,
  testId,
}: {
  value: number | null;
  format: (n: number) => string;
  testId: string;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = node.current!;
    const show = (n: number | null) => {
      shown.current = n;
      el.textContent = n === null ? "–" : format(n);
    };
    const from = shown.current;
    if (value === null || from === null || from === value) {
      show(value);
      return;
    }
    // Tint at once, fade out once it has arrived.
    el.style.transition = "none";
    el.style.color = value > from ? "var(--mint)" : "var(--injured)";
    const settle = () => {
      el.style.transition = `color ${FADE_MS}ms ease-out`;
      el.style.color = "";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show(value);
      const timer = setTimeout(settle, 300);
      return () => clearTimeout(timer);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / COUNT_MS);
      show(t === 1 ? value : from + (value - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
      else settle();
    });
    return () => cancelAnimationFrame(frame);
  }, [value, format]);

  return (
    <span
      ref={node}
      data-testid={testId}
      className="font-display text-lg leading-none font-bold text-fg tabular-nums"
    />
  );
}

/**
 * A number in a glass box, pinned to one of the pitch's top corners (the
 * expected points, the team rating). The working goes in `details`: the
 * tooltip, and the accessible name after `label`. With `onClick` it's a
 * button that opens a dialog.
 */
export function CornerStat({
  value,
  format,
  caption,
  label,
  details = [],
  testId,
  meter,
  onClick,
}: {
  /** Counts to each new value; null (no projections yet) shows a dash. */
  value: number | null;
  format: (n: number) => string;
  /** The small print under the number. */
  caption: string;
  /** What the number means, read out first. */
  label: string;
  details?: string[];
  testId: string;
  /** A bar under the caption, filled `pct` of the way (0–100) in `color`. */
  meter?: { pct: number; color: string };
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    // .glass-pill sets position: relative, so the pitch positions a wrapper round this.
    <Tag
      {...(onClick
        ? { type: "button" as const, onClick, "aria-haspopup": "dialog" as const }
        : { role: "img" })}
      data-testid={testId}
      aria-label={[label, ...details].join(". ")}
      title={details.join("\n") || undefined}
      className="glass-pill flex size-16 flex-col items-center justify-center gap-1 rounded-xl"
    >
      <CountUp value={value} format={format} testId={`${testId}-value`} />
      <span className="text-center text-[8px] leading-[1.15] font-medium tracking-[0.06em] text-muted uppercase">
        {caption}
      </span>
      {meter && (
        <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-fg/15">
          <span
            data-testid={`${testId}-meter`}
            className="block h-full rounded-full transition-[width,background-color] duration-500 ease-out"
            style={{ width: `${meter.pct}%`, backgroundColor: meter.color }}
          />
        </span>
      )}
    </Tag>
  );
}
