"use client";

import { useEffect, useReducer, type ComponentType } from "react";

/**
 * A code-split component that renders synchronously once its module has
 * loaded. Unlike `next/dynamic` / `React.lazy` it never suspends, so it
 * avoids React's ~300 ms Suspense reveal throttle: after `preload()` has
 * finished, the first open is as fast as any other.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;

  const preload = () =>
    (pending ??= load().then(
      (component) => {
        Loaded = component;
      },
      (err: unknown) => {
        pending = null; // allow a retry
        throw err;
      },
    ));

  function Lazy(props: P) {
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      if (!Loaded) preload().then(rerender, () => {});
    }, []);
    return Loaded ? <Loaded {...props} /> : null;
  }

  return { Lazy, preload };
}
