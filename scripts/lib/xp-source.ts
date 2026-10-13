import { fetchJson } from "../../src/lib/fetch-json";
import type { ProjectionSource, Projections } from "./sources";

export const XP_URL = "https://api.fplcopilot.com/api/expected-points";

/** Only the fields we use; `id` is the official FPL player id. */
interface XpPlayer {
  id: number;
  gameweeks: { gw: number; points: number | null }[];
}

export function normaliseXp(rows: XpPlayer[], gws: number): Projections {
  const out: Projections = new Map();
  for (const row of rows) {
    const values: (number | null)[] = Array(gws).fill(null);
    for (const g of row.gameweeks ?? []) {
      if (g.gw >= 1 && g.gw <= gws && typeof g.points === "number" && Number.isFinite(g.points)) {
        values[g.gw - 1] = g.points;
      }
    }
    out.set(row.id, values);
  }
  return out;
}

export function xpSource(gws: number): ProjectionSource {
  return {
    name: "FPL Copilot xP",
    async load() {
      return normaliseXp(await fetchJson<XpPlayer[]>(XP_URL, { timeoutMs: 30_000 }), gws);
    },
  };
}
