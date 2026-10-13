"use client";

import dynamic from "next/dynamic";

// Loaded after hydration to keep ~10 KB off first-load JS. web-vitals reads
// buffered performance entries, so early metrics (LCP, CLS) are still caught.
export const WebVitalsLazy = dynamic(() => import("./WebVitals").then((m) => m.WebVitals), {
  ssr: false,
});
