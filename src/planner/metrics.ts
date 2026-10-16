import type { TokenMetric } from "@/components/pitch/PlayerToken";
import { fixturesFor, xpFor, type GameData, type Player } from "@/data/model";
import type { FixturePoints } from "@/lib/fpl/types";
import { sellingPrice } from "@/engine/money";
import { formatPrice } from "./model";

/** What the pill under each player shows. */
export type Metric = "xp" | "xp3" | "xp5" | "form" | "sell" | "selected" | "points";

export const METRICS: { key: Metric; label: string }[] = [
  { key: "xp", label: "Projected points" },
  { key: "xp3", label: "Projected points, next 3" },
  { key: "xp5", label: "Projected points, next 5" },
  { key: "form", label: "Form" },
  { key: "sell", label: "Selling price" },
  { key: "selected", label: "Selected by %" },
  { key: "points", label: "Total points" },
];

export const DEFAULT_METRIC: Metric = "xp";

export function isMetric(value: unknown): value is Metric {
  return METRICS.some((m) => m.key === value);
}

/**
 * Colour tier for a points-per-gameweek rate, on the FDR colour scale so
 * green reads as good and red as poor: 1 (great) … 5 (poor).
 */
export function rateTier(perGw: number): number {
  if (perGw >= 6) return 1;
  if (perGw >= 4.5) return 2;
  if (perGw >= 3) return 3;
  if (perGw >= 1.5) return 4;
  return 5;
}

/** Projected points over `count` gameweeks from `gw`, and how many gameweeks had a projection. */
export function xpOver(
  data: GameData,
  player: Player,
  gw: number,
  count: number,
): { total: number; gws: number } {
  let total = 0;
  let gws = 0;
  for (let g = gw; g < gw + count && g <= data.events.length; g++) {
    const xp = xpFor(data, player, g);
    if (xp == null) continue;
    total += xp;
    gws++;
  }
  return { total, gws };
}

export interface MetricPills {
  pills: TokenMetric[];
  /** No fixture this gameweek: the token is greyed out. */
  blank: boolean;
}

const finishedGws = (data: GameData) => data.events.filter((e) => e.finished).length;

/**
 * The pill under a player for the chosen metric in a gameweek. All are
 * numbers: points metrics are coloured by how good the value is; selling
 * price and ownership are neutral, as neither is good or bad in itself. A
 * blank gameweek greys the player out, with nothing for the projection of
 * that gameweek. `purchase` is what the manager paid, in tenths of £1m, for
 * the selling price (a player not yet bought sells at the current price).
 */
export function metricPills(
  data: GameData,
  player: Player,
  gw: number,
  metric: Metric,
  purchase?: number,
): MetricPills {
  const blank = fixturesFor(data, player.team, gw).length === 0;
  const pill = (label: string, tier: number | null): MetricPills => ({
    pills: [{ label, difficulty: tier }],
    blank,
  });

  switch (metric) {
    case "xp": {
      if (blank) return { pills: [], blank };
      const xp = xpFor(data, player, gw);
      return xp == null ? pill("–", null) : pill(xp.toFixed(1), rateTier(xp));
    }
    case "xp3":
    case "xp5": {
      const count = metric === "xp3" ? 3 : 5;
      const { total, gws } = xpOver(data, player, gw, count);
      return gws === 0 ? pill("–", null) : pill(total.toFixed(1), rateTier(total / gws));
    }
    case "form":
      return pill(player.form.toFixed(1), rateTier(player.form));
    case "sell":
      return pill(formatPrice(sellingPrice(purchase ?? player.price, player.price)), null);
    case "selected":
      return pill(`${player.selectedBy.toFixed(1)}%`, null);
    case "points":
      return pill(String(player.totalPoints), rateTier(player.totalPoints / Math.max(1, finishedGws(data))));
  }
}

/**
 * A past gameweek's pill(s): what the player scored and who against, one per
 * fixture ("12 · BRE" at home, "3 · bre" away), coloured by the points. The
 * metric dropdown doesn't apply: past gameweeks always show this.
 */
export function pastPills(data: GameData, player: Player, fixtures: FixturePoints[]): MetricPills {
  if (fixtures.length === 0) return { pills: [], blank: true };
  const double = fixtures.length > 1;
  return {
    pills: fixtures.map(({ fixture, points }) => {
      const f = data.fixtures.find((x) => x.id === fixture);
      const home = f?.home === player.team;
      const opp = f && data.teamById.get(home ? f.away : f.home);
      const short = opp ? (home ? opp.short : opp.short.toLowerCase()) : "";
      const label = !short ? String(points) : double ? `${points} ${short}` : `${points} · ${short}`;
      return { label, difficulty: rateTier(points) };
    }),
    blank: false,
  };
}

/** Official player photo (77×80, ~12 KB) by the player's stable code. */
export function photoUrl(player: Player): string {
  // Through our origin, so the service worker can keep photos for offline use.
  return `/api/photo/${player.code}?size=small`;
}
