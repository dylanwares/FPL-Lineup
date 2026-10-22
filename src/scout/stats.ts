import type { GameData, Player, PlayerStats } from "@/data/model";
import { firstTickerGw, tickerRows } from "@/fixtures/ticker";
import { xpOver } from "@/planner/metrics";
import { formatPrice } from "@/planner/model";

/** Gameweeks the fixture run and the "next N" projections look ahead. */
export const RUN_GWS = 5;
/** Per-90 numbers are noise below this many minutes, so they show as unknown. */
export const PER90_MIN_MINUTES = 90;

export interface ScoutContext {
  data: GameData;
  /** The first upcoming gameweek: projections and fixtures count from here. */
  gw: number;
  finishedGws: number;
  /** Each team's average fixture score over the next RUN_GWS gameweeks (lower is easier). */
  run: Map<number, number>;
}

const contexts = new WeakMap<GameData, ScoutContext>();

export function scoutContext(data: GameData): ScoutContext {
  let ctx = contexts.get(data);
  if (!ctx) {
    const gw = firstTickerGw(data);
    ctx = {
      data,
      gw,
      finishedGws: data.events.filter((e) => e.finished).length,
      run: new Map(tickerRows(data, gw, RUN_GWS).map((r) => [r.team.id, r.score])),
    };
    contexts.set(data, ctx);
  }
  return ctx;
}

export type StatGroup =
  "Projection" | "Season" | "Attack" | "Defence" | "Per 90" | "Value & market" | "Fixtures";

export interface StatDef {
  label: string;
  /** Column header; fits a narrow column. */
  short: string;
  group: StatGroup;
  get: (player: Player, ctx: ScoutContext) => number | null;
  format: (value: number) => string;
  /** Lower is better, so it sorts ascending first. */
  asc?: boolean;
}

const int = (v: number) => String(Math.round(v));
const dec1 = (v: number) => v.toFixed(1);
const dec2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${v.toFixed(1)}%`;
const signed = (v: number) => (v > 0 ? `+${dec1(v)}` : dec1(v));
const priceChange = (v: number) => (v === 0 ? "0.0" : signed(v / 10));
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const count = (v: number) => compact.format(v);

const stat = (key: keyof PlayerStats) => (p: Player) => p.stats[key];
const per90 = (value: (p: Player) => number) => (p: Player) =>
  p.stats.minutes < PER90_MIN_MINUTES ? null : (value(p) * 90) / p.stats.minutes;
const perMillion = (value: number | null, p: Player) => (value == null ? null : value / (p.price / 10));
const xpNext = (n: number) => (p: Player, ctx: ScoutContext) => {
  const { total, gws } = xpOver(ctx.data, p, ctx.gw, n);
  return gws ? total : null;
};

export const STATS = {
  // Projection
  xp1: { label: "Projected points, next GW", short: "xP", group: "Projection", get: xpNext(1), format: dec1 },
  xp3: { label: "Projected points, next 3", short: "xP3", group: "Projection", get: xpNext(3), format: dec1 },
  xp5: { label: "Projected points, next 5", short: "xP5", group: "Projection", get: xpNext(5), format: dec1 },
  xp8: { label: "Projected points, next 8", short: "xP8", group: "Projection", get: xpNext(8), format: dec1 },
  xp5PerM: {
    label: "Projected points (next 5) per £1m",
    short: "xP5/£m",
    group: "Projection",
    get: (p, ctx) => perMillion(xpNext(5)(p, ctx), p),
    format: dec2,
  },

  // Season
  points: { label: "Total points", short: "Pts", group: "Season", get: (p) => p.totalPoints, format: int },
  ppg: { label: "Points per game", short: "PPG", group: "Season", get: stat("ppg"), format: dec1 },
  form: { label: "Form", short: "Form", group: "Season", get: (p) => p.form, format: dec1 },
  minutes: { label: "Minutes", short: "Mins", group: "Season", get: stat("minutes"), format: int },
  starts: { label: "Starts", short: "Starts", group: "Season", get: stat("starts"), format: int },
  minsPct: {
    label: "Share of minutes played",
    short: "Mins %",
    group: "Season",
    get: (p, ctx) => (ctx.finishedGws ? (p.stats.minutes / (90 * ctx.finishedGws)) * 100 : null),
    format: (v) => `${Math.round(v)}%`,
  },
  bonus: { label: "Bonus points", short: "Bonus", group: "Season", get: stat("bonus"), format: int },
  bps: { label: "Bonus points system", short: "BPS", group: "Season", get: stat("bps"), format: int },
  ict: { label: "ICT index", short: "ICT", group: "Season", get: stat("ict"), format: dec1 },
  dreamteam: {
    label: "Team of the week",
    short: "TOTW",
    group: "Season",
    get: stat("dreamteam"),
    format: int,
  },
  yellowCards: { label: "Yellow cards", short: "YC", group: "Season", get: stat("yellowCards"), format: int },
  redCards: { label: "Red cards", short: "RC", group: "Season", get: stat("redCards"), format: int },

  // Attack
  goals: { label: "Goals", short: "G", group: "Attack", get: stat("goals"), format: int },
  assists: { label: "Assists", short: "A", group: "Attack", get: stat("assists"), format: int },
  gi: {
    label: "Goal involvements",
    short: "G+A",
    group: "Attack",
    get: (p) => p.stats.goals + p.stats.assists,
    format: int,
  },
  xg: { label: "Expected goals", short: "xG", group: "Attack", get: stat("xg"), format: dec1 },
  xa: { label: "Expected assists", short: "xA", group: "Attack", get: stat("xa"), format: dec1 },
  xgi: { label: "Expected goal involvements", short: "xGI", group: "Attack", get: stat("xgi"), format: dec1 },
  gMinusXg: {
    label: "Goals minus expected goals",
    short: "G−xG",
    group: "Attack",
    get: (p) => p.stats.goals - p.stats.xg,
    format: signed,
  },
  threat: { label: "Threat", short: "Threat", group: "Attack", get: stat("threat"), format: int },
  creativity: { label: "Creativity", short: "Creat", group: "Attack", get: stat("creativity"), format: int },

  // Defence
  cleanSheets: {
    label: "Clean sheets",
    short: "CS",
    group: "Defence",
    get: stat("cleanSheets"),
    format: int,
  },
  goalsConceded: {
    label: "Goals conceded",
    short: "GC",
    group: "Defence",
    get: stat("goalsConceded"),
    format: int,
    asc: true,
  },
  xgc: {
    label: "Expected goals conceded",
    short: "xGC",
    group: "Defence",
    get: stat("xgc"),
    format: dec1,
    asc: true,
  },
  defCon: {
    label: "Defensive contributions",
    short: "DC",
    group: "Defence",
    get: stat("defCon"),
    format: int,
  },
  cbi: {
    label: "Clearances, blocks & interceptions",
    short: "CBI",
    group: "Defence",
    get: stat("cbi"),
    format: int,
  },
  recoveries: { label: "Recoveries", short: "Rec", group: "Defence", get: stat("recoveries"), format: int },
  tackles: { label: "Tackles", short: "Tkl", group: "Defence", get: stat("tackles"), format: int },
  saves: { label: "Saves", short: "Saves", group: "Defence", get: stat("saves"), format: int },
  penaltiesSaved: {
    label: "Penalties saved",
    short: "PS",
    group: "Defence",
    get: stat("penaltiesSaved"),
    format: int,
  },

  // Per 90
  pts90: {
    label: "Points per 90",
    short: "Pts/90",
    group: "Per 90",
    get: per90((p) => p.totalPoints),
    format: dec1,
  },
  xg90: { label: "xG per 90", short: "xG/90", group: "Per 90", get: per90((p) => p.stats.xg), format: dec2 },
  xa90: { label: "xA per 90", short: "xA/90", group: "Per 90", get: per90((p) => p.stats.xa), format: dec2 },
  xgi90: {
    label: "xGI per 90",
    short: "xGI/90",
    group: "Per 90",
    get: per90((p) => p.stats.xgi),
    format: dec2,
  },
  xgc90: {
    label: "xGC per 90",
    short: "xGC/90",
    group: "Per 90",
    get: per90((p) => p.stats.xgc),
    format: dec2,
    asc: true,
  },
  defCon90: {
    label: "Defensive contributions per 90",
    short: "DC/90",
    group: "Per 90",
    get: per90((p) => p.stats.defCon),
    format: dec1,
  },
  saves90: {
    label: "Saves per 90",
    short: "Sv/90",
    group: "Per 90",
    get: per90((p) => p.stats.saves),
    format: dec1,
  },

  // Value & market
  price: {
    label: "Price",
    short: "Price",
    group: "Value & market",
    get: (p) => p.price,
    format: formatPrice,
  },
  ptsPerM: {
    label: "Points per £1m",
    short: "Pts/£m",
    group: "Value & market",
    get: (p) => perMillion(p.totalPoints, p),
    format: dec1,
  },
  selected: {
    label: "Selected by",
    short: "Sel",
    group: "Value & market",
    get: (p) => p.selectedBy,
    format: pct,
  },
  netTransfers: {
    label: "Net transfers this GW",
    short: "Net",
    group: "Value & market",
    get: (p) => p.stats.transfersIn - p.stats.transfersOut,
    format: (v) => (v > 0 ? `+${count(v)}` : count(v)),
  },
  transfersIn: {
    label: "Transfers in this GW",
    short: "In",
    group: "Value & market",
    get: stat("transfersIn"),
    format: count,
  },
  transfersOut: {
    label: "Transfers out this GW",
    short: "Out",
    group: "Value & market",
    get: stat("transfersOut"),
    format: count,
  },
  priceGw: {
    label: "Price change this GW",
    short: "±GW",
    group: "Value & market",
    get: stat("priceChangeGw"),
    format: priceChange,
  },
  priceStart: {
    label: "Price change this season",
    short: "±Season",
    group: "Value & market",
    get: stat("priceChangeStart"),
    format: priceChange,
  },

  // Fixtures
  run: {
    label: `Fixture difficulty, next ${RUN_GWS}`,
    short: "FDR",
    group: "Fixtures",
    get: (p, ctx) => ctx.run.get(p.team) ?? null,
    format: dec1,
    asc: true,
  },
} satisfies Record<string, StatDef>;

export type StatId = keyof typeof STATS;
export const STAT_IDS = Object.keys(STATS) as StatId[];

export function isStatId(value: unknown): value is StatId {
  return typeof value === "string" && Object.hasOwn(STATS, value);
}

export function statDef(id: StatId): StatDef {
  return STATS[id];
}

/** Stats grouped for a picker, in registry order. */
export function statGroups(): [StatGroup, StatId[]][] {
  const groups = new Map<StatGroup, StatId[]>();
  for (const id of STAT_IDS) {
    const group = statDef(id).group;
    groups.set(group, [...(groups.get(group) ?? []), id]);
  }
  return [...groups];
}

export interface ColumnSet {
  label: string;
  stats: StatId[];
  /** Shows the next RUN_GWS fixtures in place of the stat columns. */
  fixtures?: boolean;
}

/** The column presets: four stats each, sized for a phone. */
export const COLUMN_SETS = {
  overview: { label: "Overview", stats: ["xp1", "xp5", "form", "points"] },
  attack: { label: "Attack", stats: ["goals", "assists", "xgi", "xgi90"] },
  defence: { label: "Defence", stats: ["cleanSheets", "xgc90", "defCon", "defCon90"] },
  value: { label: "Value", stats: ["ptsPerM", "xp5PerM", "ppg", "selected"] },
  market: { label: "Market", stats: ["selected", "netTransfers", "priceGw", "priceStart"] },
  fixtures: { label: "Fixtures", stats: ["run"], fixtures: true },
} satisfies Record<string, ColumnSet>;

export type ColumnSetId = keyof typeof COLUMN_SETS;
export const COLUMN_SET_IDS = Object.keys(COLUMN_SETS) as ColumnSetId[];

/**
 * The stat columns on screen: the preset's, with the sort stat swapped in for
 * the last one when the preset doesn't already show it.
 */
export function visibleStats(set: ColumnSetId, sort: StatId): StatId[] {
  const stats: StatId[] = [...COLUMN_SETS[set].stats];
  if (!stats.includes(sort)) stats[stats.length - 1] = sort;
  return stats;
}
