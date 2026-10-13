"use client";

import { useEffect } from "react";
import type { Metric } from "web-vitals";

function report(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    path: location.pathname,
  });
  if (process.env.NODE_ENV !== "production") {
    console.debug("[web-vitals]", body);
    return;
  }
  if (!navigator.sendBeacon?.("/api/vitals", body)) {
    fetch("/api/vitals", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

/**
 * Real-user vitals (INP, LCP, CLS…) sent to /api/vitals. The library loads
 * after hydration to stay off first-load JS; it reads buffered performance
 * entries, so early metrics (LCP, CLS) are still caught.
 */
export function WebVitals() {
  useEffect(() => {
    let active = true;
    void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      if (!active) return;
      for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) on(report);
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
