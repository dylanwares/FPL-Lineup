import type { GameData, Player } from "@/data/model";
import { xpFor } from "@/data/model";
import { sellingPrice } from "@/engine/money";
import { isEmptySlot, type GwState } from "@/engine/types";

export type SortKey = "xp" | "price" | "form" | "points" | "selected";

export interface CandidateFilters {
  query: string;
  /** Team id, or null for all teams. */
  team: number | null;
  /** Max price in tenths, or null for any. */
  maxPrice: number | null;
  /** Only show players the user can afford. */
  affordable: boolean;
  /** Only show players starred in Scout. */
  watchlist: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: CandidateFilters = {
  query: "",
  team: null,
  maxPrice: null,
  affordable: false,
  watchlist: false,
  sort: "xp",
};

export interface Candidate {
  player: Player;
  /** The value sorted on (xP, price…), for display. */
  value: number | null;
  /** Why the player is dimmed (still selectable, for planning). */
  reasons: string[];
}

const folded = new WeakMap<GameData, Map<number, string>>();

/** Lower-case, accent-free names so "odegaard" finds "Ødegaard" and "joao" finds "João". */
export function searchKey(data: GameData, player: Player): string {
  let map = folded.get(data);
  if (!map) folded.set(data, (map = new Map()));
  let key = map.get(player.id);
  if (key === undefined) {
    key = fold(player.name);
    map.set(player.id, key);
  }
  return key;
}

export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ø/gi, "o")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

export function sortValue(data: GameData, player: Player, gw: number, sort: SortKey): number | null {
  switch (sort) {
    case "xp":
      return xpFor(data, player, gw);
    case "price":
      return player.price;
    case "form":
      return player.form;
    case "points":
      return player.totalPoints;
    case "selected":
      return player.selectedBy;
  }
}

/** Money available for a replacement: the bank plus the outgoing player's selling price. */
export function budgetFor(data: GameData, state: GwState, out: number): number {
  if (isEmptySlot(out)) return state.bank;
  const price = data.playerById.get(out)?.price ?? 0;
  return state.bank + sellingPrice(state.purchase[out] ?? price, price);
}

/**
 * Replacements for `out` (a player, or an empty slot to fill): same position, not already in the squad, filtered
 * and sorted (best first). Players who can't be afforded or would be a fourth
 * from one club are kept but carry a reason, so users can still plan a sequence.
 */
export function candidatesFor(
  data: GameData,
  state: GwState,
  out: number,
  gw: number,
  filters: CandidateFilters,
  maxPerClub: number,
  watchlist: ReadonlySet<number> = new Set(),
): Candidate[] {
  const outPlayer = data.playerById.get(Math.abs(out));
  if (!outPlayer) return [];
  const budget = budgetFor(data, state, out);
  const owned = new Set(state.slots);

  const clubCounts = new Map<number, number>();
  for (const id of state.slots) {
    if (id === out) continue;
    const team = data.playerById.get(id)?.team;
    if (team !== undefined) clubCounts.set(team, (clubCounts.get(team) ?? 0) + 1);
  }

  const query = fold(filters.query.trim());
  const out_: Candidate[] = [];
  for (const p of data.players) {
    if (p.pos !== outPlayer.pos || owned.has(p.id)) continue;
    if (filters.team !== null && p.team !== filters.team) continue;
    if (filters.maxPrice !== null && p.price > filters.maxPrice) continue;
    if (filters.affordable && p.price > budget) continue;
    if (filters.watchlist && !watchlist.has(p.id)) continue;
    if (query && !searchKey(data, p).includes(query)) continue;

    const reasons: string[] = [];
    if (p.price > budget) reasons.push(`£${((p.price - budget) / 10).toFixed(1)}m over budget`);
    if ((clubCounts.get(p.team) ?? 0) >= maxPerClub) {
      reasons.push(`${maxPerClub + 1}th from ${data.teamById.get(p.team)?.short ?? "club"}`);
    }
    out_.push({ player: p, value: sortValue(data, p, gw, filters.sort), reasons });
  }

  // Best first; unknown values last; ties by price, then name for stable order.
  return out_.sort(
    (a, b) =>
      (b.value ?? -Infinity) - (a.value ?? -Infinity) ||
      b.player.price - a.player.price ||
      a.player.name.localeCompare(b.player.name),
  );
}
