import type { SeasonRules } from "./types";

const FIRST_HALF = { start: 1, stop: 19 };
const SECOND_HALF = { start: 20, stop: 38 };
// Wildcard and Free Hit can't be played in GW1 (no transfers to make yet).
const FIRST_HALF_TRANSFER = { start: 2, stop: 19 };

/** 2026/27 rules — unchanged from 2025/26. */
export const rules2026_27: SeasonRules = {
  season: "2026-27",
  firstGw: 1,
  lastGw: 38,
  squad: {
    size: 15,
    starters: 11,
    maxPerClub: 3,
    budget: 1000,
    positions: {
      GKP: { squad: 2, minPlay: 1, maxPlay: 1 },
      DEF: { squad: 5, minPlay: 3, maxPlay: 5 },
      MID: { squad: 5, minPlay: 2, maxPlay: 5 },
      FWD: { squad: 3, minPlay: 1, maxPlay: 3 },
    },
  },
  transfers: {
    freePerGw: 1,
    maxBanked: 5,
    hitCost: 4,
    overrides: [],
  },
  chips: [
    { name: "wildcard", window: FIRST_HALF_TRANSFER },
    { name: "wildcard", window: SECOND_HALF },
    { name: "freehit", window: FIRST_HALF_TRANSFER },
    { name: "freehit", window: SECOND_HALF },
    { name: "bboost", window: FIRST_HALF },
    { name: "bboost", window: SECOND_HALF },
    { name: "3xc", window: FIRST_HALF },
    { name: "3xc", window: SECOND_HALF },
  ],
  maxChipsPerGw: 1,
  captainMultiplier: { normal: 2, triple: 3 },
};
