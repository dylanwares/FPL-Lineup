"use client";

import { useReportWebVitals } from "next/web-vitals";

/** Real-user vitals (INP, LCP, CLS…) sent to /api/vitals. */
export function WebVitals() {
  useReportWebVitals((metric) => {
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
  });
  return null;
}
