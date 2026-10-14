import type { ChipName, SeasonRules } from "@/config/rules";
import type { ChipUse } from "./types";

export type ChipAvailability = "available" | "used" | "unavailable";

/**
 * Whether a chip can be played in a gameweek, given the chips already used.
 * Each copy in the rules is usable once inside its window; "used" means every
 * copy whose window covers this gameweek has gone, "unavailable" means no
 * copy's window covers it, or the chip was played the gameweek before and
 * can't be played back to back (Free Hit).
 */
export function chipAvailability(
  name: ChipName,
  gw: number,
  used: ChipUse[],
  rules: SeasonRules,
): ChipAvailability {
  const copies = rules.chips.filter((c) => c.name === name);
  const covering = copies.filter((c) => gw >= c.window.start && gw <= c.window.stop);
  if (covering.length === 0) return "unavailable";
  if (rules.noConsecutive.includes(name) && used.some((u) => u.name === name && u.gw === gw - 1)) {
    return "unavailable";
  }
  const free = covering.some(
    (c) => !used.some((u) => u.name === name && u.gw >= c.window.start && u.gw <= c.window.stop),
  );
  return free ? "available" : "used";
}
