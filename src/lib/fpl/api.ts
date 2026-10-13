import { cacheLife } from "next/cache";
import { fetchJson } from "@/lib/fetch-json";
import type { FplBootstrapSlim, FplEntry, FplHistory, FplPicks, FplTransfer } from "./types";

/**
 * Cached server-side access to the FPL API. Entry data is cached for five
 * minutes (the spec's import cache); finished gameweeks' picks never change.
 * Failed requests throw and are not cached.
 */
const BASE = "https://fantasy.premierleague.com/api";

// FPL is often slow or unavailable around deadlines: retry with backoff, but
// keep the total wait short enough for an interactive request.
const OPTS = { retries: 2, baseDelayMs: 400, timeoutMs: 10_000 };

export async function getBootstrapSlim(): Promise<FplBootstrapSlim> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const raw = await fetchJson<FplBootstrapSlim>(`${BASE}/bootstrap-static/`, OPTS);
  // Keep only what the import needs; the full response is ~1.8 MB.
  return {
    events: raw.events.map(({ id, is_current, is_next, finished }) => ({
      id,
      is_current,
      is_next,
      finished,
    })),
    elements: raw.elements.map(({ id, now_cost, cost_change_start }) => ({
      id,
      now_cost,
      cost_change_start,
    })),
  };
}

export async function getEntry(entryId: number): Promise<FplEntry> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const e = await fetchJson<FplEntry>(`${BASE}/entry/${entryId}/`, OPTS);
  return {
    id: e.id,
    name: e.name,
    player_first_name: e.player_first_name,
    player_last_name: e.player_last_name,
    started_event: e.started_event,
    current_event: e.current_event,
  };
}

export async function getHistory(entryId: number): Promise<FplHistory> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return fetchJson<FplHistory>(`${BASE}/entry/${entryId}/history/`, OPTS);
}

export async function getTransfers(entryId: number): Promise<FplTransfer[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return fetchJson<FplTransfer[]>(`${BASE}/entry/${entryId}/transfers/`, OPTS);
}

export async function getPicks(entryId: number, gw: number, finished: boolean): Promise<FplPicks> {
  "use cache";
  if (finished) cacheLife("max");
  else cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return fetchJson<FplPicks>(`${BASE}/entry/${entryId}/event/${gw}/picks/`, OPTS);
}
