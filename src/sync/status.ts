"use client";

import { create } from "zustand";

/** How plan sync is doing, for the account menu. */
export const useSyncStatus = create<{
  state: "idle" | "syncing" | "synced" | "offline" | "error";
  /** When the last sync finished. */
  at?: number;
}>(() => ({ state: "idle" }));
