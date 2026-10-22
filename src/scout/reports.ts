import { DEFAULT_FILTERS, type ScoutFilters } from "./filter";

export interface Report {
  id: string;
  label: string;
  /** One line on what it finds, shown under the chips. */
  blurb: string;
  filters: ScoutFilters;
}

/** Regulars only: filters out players who have barely played. */
const REGULAR = 270;

const report = (id: string, label: string, blurb: string, filters: Partial<ScoutFilters>): Report => ({
  id,
  label,
  blurb,
  filters: { ...DEFAULT_FILTERS, available: true, ...filters },
});

/** One-tap scout reports: each replaces every filter, the sort and the columns. */
export const REPORTS: Report[] = [
  report("captain", "Captain picks", "Highest projected points next gameweek.", { sort: "xp1" }),
  report("differentials", "Differentials", "Under 5% owned, best projections over the next 5.", {
    maxOwned: 5,
    minMinutes: REGULAR,
  }),
  report("enablers", "Budget enablers", "£4.5m or less and playing, best projections over the next 5.", {
    maxPrice: 45,
    minMinutes: REGULAR,
  }),
  report("fixtures", "Fixture swing", "Regulars with the easiest next 5 fixtures.", {
    sort: "run",
    cols: "fixtures",
    minMinutes: REGULAR,
  }),
  report("rising", "Rising", "Most transferred in this gameweek.", { sort: "netTransfers", cols: "market" }),
  report("defcon", "DefCon defenders", "Defenders racking up defensive contributions per 90.", {
    pos: ["DEF"],
    sort: "defCon90",
    cols: "defence",
    minMinutes: REGULAR,
  }),
  report("threat", "Underlying threat", "Most expected goal involvements per 90.", {
    pos: ["MID", "FWD"],
    sort: "xgi90",
    cols: "attack",
    minMinutes: 450,
  }),
  report("pens", "On penalties", "First-choice penalty takers.", { setPiece: "pen" }),
];

/** The report the filters match exactly (ignoring the search box and the watchlist chip), if any. */
export function matchingReport(filters: ScoutFilters): Report | null {
  const keys = (Object.keys(DEFAULT_FILTERS) as (keyof ScoutFilters)[]).filter(
    (k) => k !== "query" && k !== "watchlist",
  );
  const norm = (v: unknown) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
  return REPORTS.find((r) => keys.every((k) => norm(r.filters[k]) === norm(filters[k]))) ?? null;
}
