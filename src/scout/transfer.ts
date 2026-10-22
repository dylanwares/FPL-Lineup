import type { GameData, Player } from "@/data/model";
import { isEmptySlot, type GwState } from "@/engine/types";
import { budgetFor } from "@/planner/candidates";
import { formatPrice } from "@/planner/model";

export interface TransferOption {
  /** The squad player sold, or an empty slot (negative id) filled. */
  out: number;
  /** For an empty slot, the player removed from it. */
  outPlayer: Player;
  empty: boolean;
  /** Bank plus the outgoing player's selling price. */
  budget: number;
  /** Why the move breaks a rule (it can still be planned, as in the transfer list). */
  reasons: string[];
}

/**
 * Who `incoming` could replace in a gameweek: every squad slot in the same
 * position, empty slots first. Null when the player is already in the squad.
 */
export function transferOptions(
  data: GameData,
  state: GwState,
  incoming: Player,
  maxPerClub: number,
): TransferOption[] | null {
  if (state.slots.includes(incoming.id)) return null;

  const options: TransferOption[] = [];
  for (const out of state.slots) {
    const outPlayer = data.playerById.get(Math.abs(out));
    if (!outPlayer || outPlayer.pos !== incoming.pos) continue;
    const budget = budgetFor(data, state, out);
    const clubCount = state.slots.filter(
      (id) => id !== out && !isEmptySlot(id) && data.playerById.get(id)?.team === incoming.team,
    ).length;

    const reasons: string[] = [];
    if (incoming.price > budget) reasons.push(`${formatPrice(incoming.price - budget)} over budget`);
    if (clubCount >= maxPerClub) {
      reasons.push(`${maxPerClub + 1}th from ${data.teamById.get(incoming.team)?.short ?? "club"}`);
    }
    options.push({ out, outPlayer, empty: isEmptySlot(out), budget, reasons });
  }
  return options.sort((a, b) => Number(b.empty) - Number(a.empty));
}
