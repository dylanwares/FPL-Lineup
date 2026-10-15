"use client";

import { useSyncExternalStore } from "react";

/*
 * Installing the app. Chrome and Edge (Android, desktop) offer a real install
 * dialog through `beforeinstallprompt`; iOS has none, so there we show how to
 * use Share → Add to Home Screen. Nothing is offered once installed.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How this browser installs: its own dialog, the iOS steps, or not at all (installed, unsupported). */
export type InstallMode = "prompt" | "ios" | null;

const state = { deferred: null as InstallPromptEvent | null, installed: false, iosSteps: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep it for our button and banner instead of Chrome's own mini bar.
    e.preventDefault();
    state.deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    state.deferred = null;
    state.installed = true;
    emit();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but with touch.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function mode(): InstallMode {
  if (state.installed || isStandalone()) return null;
  if (state.deferred) return "prompt";
  return isIos() ? "ios" : null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, mode, () => null);
}

export function useIosSteps(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.iosSteps,
    () => false,
  );
}

/** Opens the browser's install dialog, or the iOS steps. */
export async function startInstall() {
  const prompt = state.deferred;
  if (!prompt) {
    state.iosSteps = true;
    emit();
    return;
  }
  // A prompt can only be shown once; Chrome fires a new event if it can be offered again.
  state.deferred = null;
  emit();
  await prompt.prompt();
  await prompt.userChoice.catch(() => {});
}

const VISITS_KEY = "fpl-lineup:visits";
const DISMISSED_KEY = "fpl-lineup:install-dismissed";
/** The banner waits for a returning visitor: this many visits (one per browser session). */
const BANNER_FROM_VISIT = 2;
let bannerDue: boolean | undefined;

/** Counts this visit (once per session) and says whether the install banner is still due. */
function checkBanner(): boolean {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return false;
    let visits = Number(localStorage.getItem(VISITS_KEY)) || 0;
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, "1");
      localStorage.setItem(VISITS_KEY, String(++visits));
    }
    return visits >= BANNER_FROM_VISIT;
  } catch {
    return false;
  }
}

export function useBannerDue(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (bannerDue ??= checkBanner()),
    () => false,
  );
}

/** Retires the install banner for good (the account menu still offers installing). */
export function dismissBanner() {
  bannerDue = false;
  emit();
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Storage blocked: it stays away for this visit.
  }
}

export function closeIosSteps() {
  state.iosSteps = false;
  emit();
}
