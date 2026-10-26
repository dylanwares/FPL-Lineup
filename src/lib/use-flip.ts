"use client";

import { useLayoutEffect, useRef } from "react";

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Animates rows to their new places when the order changes (FLIP), so a
 * re-sort or filter reads as movement rather than a jump. With `enter`, rows
 * that weren't there before fade up into place. `order` is the rows' keys,
 * joined: the animation runs when it changes. Returns a ref callback per key.
 */
export function useFlip<K>(order: string, { enter = false }: { enter?: boolean } = {}) {
  const els = useRef(new Map<K, HTMLElement>());
  const tops = useRef(new Map<K, number>());

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Nothing to move from on the first render.
    const first = tops.current.size === 0;
    const next = new Map<K, number>();
    for (const [id, el] of els.current) {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      if (reduce || first || !el.offsetParent) continue;
      const before = tops.current.get(id);
      if (before === undefined) {
        if (enter) {
          el.animate(
            [
              { opacity: 0, transform: "translateY(12px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 320, easing: EASING },
          );
        }
      } else if (before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 320,
          easing: EASING,
        });
      }
    }
    tops.current = next;
  }, [order, enter]);

  return (id: K) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
}
