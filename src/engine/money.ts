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
 * Free transfers going into the next gameweek.
 * - Normally: unused ones roll over and one more is added, up to the cap.
 * - After a Wildcard or Free Hit: the saved transfers are kept exactly, with
 *   no extra one ("if you had 2 saved free transfers, you will still have 2
 *   the Gameweek after playing the chip" — official FPL rules).
 */
export function nextFreeTransfers(
  available: number,
  transfersMade: number,
  chip: ChipName | null,
  nextGw: number,
  rules: SeasonRules,
): number {
  const override = rules.transfers.overrides.find((o) => o.gw === nextGw);
  if (override) return override.setTo;
  if (FREE_TRANSFER_CHIPS.has(chip)) return Math.min(rules.transfers.maxBanked, available);
  const left = Math.max(0, available - transfersMade);
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
