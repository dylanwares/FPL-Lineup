import type { ChipName, SeasonRules } from "@/config/rules";

/**
 * FPL selling price: the purchase price plus half of any rise, rounded down to
 * £0.1m. If the price has fallen, the player sells at the current price.
 * All values in tenths of £1m.
 */
export function sellingPrice(purchase: number, current: number): number {
  if (current <= purchase) return current;
  return purchase + Math.floor((current - purchase) / 2);
}

export const FREE_TRANSFER_CHIPS: ReadonlySet<ChipName | null> = new Set(["wildcard", "freehit"]);

/**
 * Free transfers going into the next gameweek. Unused ones roll over up to the
 * season cap; a Wildcard or Free Hit keeps the saved ones (transfers that week are free).
 */
export function nextFreeTransfers(
  available: number,
  transfersMade: number,
  chip: ChipName | null,
  nextGw: number,
  rules: SeasonRules,
): number {
  const left = FREE_TRANSFER_CHIPS.has(chip) ? available : Math.max(0, available - transfersMade);
  const override = rules.transfers.overrides.find((o) => o.gw === nextGw);
  if (override) return override.setTo;
  return Math.min(rules.transfers.maxBanked, left + rules.transfers.freePerGw);
}

/** Points deducted for a gameweek's transfers. */
export function transferCost(
  available: number,
  transfersMade: number,
  chip: ChipName | null,
  rules: SeasonRules,
): number {
  if (FREE_TRANSFER_CHIPS.has(chip)) return 0;
  return Math.max(0, transfersMade - available) * rules.transfers.hitCost;
}
