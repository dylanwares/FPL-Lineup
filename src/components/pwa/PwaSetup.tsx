"use client";

import { useEffect } from "react";
import { lazyComponent } from "@/lib/lazy";
import { useBannerDue, useInstallMode, useIosSteps } from "./install";

const installLayer = lazyComponent(() => import("./InstallLayer").then((m) => m.InstallLayer));

/** Hashed assets this page already loaded, for the worker to keep (it can't see loads from before it took control). */
function sendLoadedAssets(worker: ServiceWorker | null | undefined) {
  const urls = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(`${location.origin}/_next/static/`));
  worker?.postMessage({ type: "cache", urls });
}

/**
 * Registers the service worker (production only: dev chunks change on every
 * edit) and shows the install banner and iOS steps when they're due.
 */
export function PwaSetup() {
  const mode = useInstallMode();
  const iosSteps = useIosSteps();
  const due = useBannerDue();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        sendLoadedAssets(reg.active);
        // Again once the idle-time preloads (sheets, ticker) have landed.
        setTimeout(() => sendLoadedAssets(reg.active), 10_000);
      })
      .catch(() => {});
  }, []);

  const banner = due && mode !== null;
  if (!banner && !iosSteps) return null;
  return <installLayer.Lazy banner={banner} />;
}
