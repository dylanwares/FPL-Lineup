export type Position = "GKP" | "DEF" | "MID" | "FWD";

export type ChipName = "wildcard" | "freehit" | "bboost" | "3xc";

export interface ChipWindow {
  /** First gameweek the chip can be played in (inclusive). */
  start: number;
  /** Last gameweek the chip can be played in (inclusive). */
  stop: number;
}

export interface PositionRule {
  /** Players of this position in a 15-man squad. */
  squad: number;
  /** Minimum starters of this position in a valid line-up. */
  minPlay: number;
  /** Maximum starters of this position in a valid line-up. */
  maxPlay: number;
}

export interface SeasonRules {
  season: string;
  firstGw: number;
  lastGw: number;
  squad: {
    size: number;
    starters: number;
    maxPerClub: number;
    /** Starting budget in tenths of £1m (1000 = £100.0m). */
    budget: number;
    positions: Record<Position, PositionRule>;
  };
  transfers: {
    /** Free transfers added at the start of each gameweek after the first. */
    freePerGw: number;
    /** Most free transfers that can be banked. */
    maxBanked: number;
    /** Points deducted per transfer beyond the free ones. */
    hitCost: number;
    /**
     * One-off top-ups FPL announces mid-season (e.g. "everyone gets 5 FTs in GW16").
     * Applied after normal rollover for that gameweek.
     */
    overrides: { gw: number; setTo: number }[];
  };
  /** Each entry is one copy of a chip, usable once inside its window. */
  chips: { name: ChipName; window: ChipWindow }[];
  maxChipsPerGw: number;
  /** Captain multiplier without and with Triple Captain. */
  captainMultiplier: { normal: number; triple: number };
}
