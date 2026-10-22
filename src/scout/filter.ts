import type { Position } from "@/config/rules";
import { fixturesFor, type GameData, type Player } from "@/data/model";
import { fold, searchKey } from "@/planner/candidates";
import {
  COLUMN_SET_IDS,
  isStatId,
  RUN_GWS,
  statDef,
  type ColumnSetId,
  type ScoutContext,
  type StatId,
} from "./stats";

export const POSITIONS: Position[] = ["GKP", "DEF", "MID", "FWD"];

export type SetPieceFilter = "pen" | "any";
export type FixtureFilter = "double" | "noBlank";

export interface ScoutFilters {
  query: string;
  /** Empty for every position. */
  pos: Position[];
  team: number | null;
  /** Prices in tenths of £1m. */
  minPrice: number | null;
  maxPrice: number | null;
  /** Selected-by %, at most. */
  maxOwned: number | null;
  minMinutes: number;
  /** Hide injured, suspended and unavailable players (doubtful ones stay). */
  available: boolean;
  /** On penalties, or on any set piece. */
  setPiece: SetPieceFilter | null;
  /** Over the next RUN_GWS gameweeks. */
  fixtures: FixtureFilter | null;
  /** Hide players in the plan's squad. */
  hideOwned: boolean;
  /** Only starred players. Kept apart from the panel's filters: it has its own chip and survives Reset. */
  watchlist: boolean;
  sort: StatId;
  /** Opposite of the stat's natural order. */
  reverse: boolean;
  cols: ColumnSetId;
}

export const DEFAULT_FILTERS: ScoutFilters = {
  query: "",
  pos: [],
  team: null,
  minPrice: null,
  maxPrice: null,
  maxOwned: null,
  minMinutes: 0,
  available: false,
  setPiece: null,
  fixtures: null,
  hideOwned: false,
  watchlist: false,
  sort: "xp5",
  reverse: false,
  cols: "overview",
};

/** How many filters (not the view: sort and columns) differ from the defaults. */
export function activeFilterCount(f: ScoutFilters): number {
  return [
    f.team !== null,
    f.minPrice !== null,
    f.maxPrice !== null,
    f.maxOwned !== null,
    f.minMinutes > 0,
    f.available,
    f.setPiece !== null,
    f.fixtures !== null,
    f.hideOwned,
  ].filter(Boolean).length;
}

export interface ScoutRow {
  player: Player;
  owned: boolean;
}

function fixtureCounts(data: GameData, team: number, gw: number) {
  let blank = false;
  let double = false;
  for (let g = gw; g < gw + RUN_GWS && g <= data.events.length; g++) {
    const n = fixturesFor(data, team, g).length;
    if (n === 0) blank = true;
    if (n > 1) double = true;
  }
  return { blank, double };
}

/** Players matching the filters, sorted (unknown values always last; ties by price, then name). */
export function scoutRows(
  ctx: ScoutContext,
  filters: ScoutFilters,
  owned: ReadonlySet<number> = new Set(),
  watchlist: ReadonlySet<number> = new Set(),
): ScoutRow[] {
  const { data } = ctx;
  const query = fold(filters.query.trim());
  const teamQuery = query && data.teams.find((t) => fold(t.short) === query || fold(t.name) === query);
  const fixtureCache = new Map<number, { blank: boolean; double: boolean }>();

  const rows: (ScoutRow & { value: number | null })[] = [];
  for (const p of data.players) {
    if (filters.watchlist && !watchlist.has(p.id)) continue;
    if (filters.pos.length && !filters.pos.includes(p.pos)) continue;
    if (filters.team !== null && p.team !== filters.team) continue;
    if (filters.minPrice !== null && p.price < filters.minPrice) continue;
    if (filters.maxPrice !== null && p.price > filters.maxPrice) continue;
    if (filters.maxOwned !== null && p.selectedBy > filters.maxOwned) continue;
    if (p.stats.minutes < filters.minMinutes) continue;
    if (filters.available && p.status !== "a" && p.status !== "d") continue;
    if (filters.setPiece === "pen" && p.stats.penOrder !== 1) continue;
    if (
      filters.setPiece === "any" &&
      p.stats.penOrder !== 1 &&
      p.stats.cornerOrder !== 1 &&
      p.stats.fkOrder !== 1
    ) {
      continue;
    }
    if (filters.fixtures) {
      let fx = fixtureCache.get(p.team);
      if (!fx) fixtureCache.set(p.team, (fx = fixtureCounts(data, p.team, ctx.gw)));
      if (filters.fixtures === "double" ? !fx.double : fx.blank) continue;
    }
    const isOwned = owned.has(p.id);
    if (filters.hideOwned && isOwned) continue;
    // A club's name or short name lists its players; anything else matches player names.
    if (query && (teamQuery ? p.team !== teamQuery.id : !searchKey(data, p).includes(query))) continue;
    rows.push({ player: p, owned: isOwned, value: statDef(filters.sort).get(p, ctx) });
  }

  const def = statDef(filters.sort);
  const dir = (def.asc ? 1 : -1) * (filters.reverse ? -1 : 1);
  rows.sort(
    (a, b) =>
      (a.value == null ? 1 : 0) - (b.value == null ? 1 : 0) ||
      (a.value != null && b.value != null ? (a.value - b.value) * dir : 0) ||
      b.player.price - a.player.price ||
      a.player.name.localeCompare(b.player.name),
  );
  return rows.map(({ player, owned }) => ({ player, owned }));
}

/* ---------------- URL ---------------- */

const price = (tenths: number) => (tenths / 10).toFixed(1);
const parsePrice = (s: string | null) => {
  const n = Number(s);
  return s && Number.isFinite(n) && n > 0 ? Math.round(n * 10) : null;
};

/** The filters as a query string (defaults left out), "" when nothing differs. */
export function filtersToSearch(data: GameData, f: ScoutFilters): string {
  const q = new URLSearchParams();
  if (f.query.trim()) q.set("q", f.query.trim());
  if (f.pos.length) q.set("pos", f.pos.join(","));
  if (f.team !== null) q.set("team", data.teamById.get(f.team)?.short ?? "");
  if (f.minPrice !== null) q.set("min", price(f.minPrice));
  if (f.maxPrice !== null) q.set("max", price(f.maxPrice));
  if (f.maxOwned !== null) q.set("own", String(f.maxOwned));
  if (f.minMinutes) q.set("mins", String(f.minMinutes));
  if (f.available) q.set("fit", "1");
  if (f.setPiece) q.set("sp", f.setPiece);
  if (f.fixtures) q.set("fx", f.fixtures === "double" ? "dgw" : "noblank");
  if (f.hideOwned) q.set("mine", "hide");
  if (f.watchlist) q.set("watch", "1");
  if (f.sort !== DEFAULT_FILTERS.sort) q.set("sort", f.sort);
  if (f.reverse) q.set("rev", "1");
  if (f.cols !== DEFAULT_FILTERS.cols) q.set("cols", f.cols);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Filters from a query string; anything unrecognised falls back to the default. */
export function filtersFromSearch(data: GameData, search: string): ScoutFilters {
  const q = new URLSearchParams(search);
  const num = (key: string) => {
    const n = Number(q.get(key));
    return q.has(key) && Number.isFinite(n) && n > 0 ? n : null;
  };
  const team = q.get("team")?.toUpperCase();
  const sort = q.get("sort");
  const cols = q.get("cols");
  const sp = q.get("sp");
  const fx = q.get("fx");
  return {
    query: q.get("q") ?? "",
    pos: POSITIONS.filter((p) => q.get("pos")?.toUpperCase().split(",").includes(p)),
    team: data.teams.find((t) => t.short === team)?.id ?? null,
    minPrice: parsePrice(q.get("min")),
    maxPrice: parsePrice(q.get("max")),
    maxOwned: num("own"),
    minMinutes: num("mins") ?? 0,
    available: q.get("fit") === "1",
    setPiece: sp === "pen" || sp === "any" ? sp : null,
    fixtures: fx === "dgw" ? "double" : fx === "noblank" ? "noBlank" : null,
    hideOwned: q.get("mine") === "hide",
    watchlist: q.get("watch") === "1",
    sort: isStatId(sort) ? sort : DEFAULT_FILTERS.sort,
    reverse: q.get("rev") === "1",
    cols: COLUMN_SET_IDS.find((c) => c === cols) ?? DEFAULT_FILTERS.cols,
  };
}
