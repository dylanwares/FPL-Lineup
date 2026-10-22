import { create } from "zustand";

const KEY = "fpl-lineup:watchlist";

function read(): number[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

/** Starred players (FPL ids), kept on the device. Newest last. */
export const useWatchlist = create<{ ids: number[] }>(() => ({
  ids: typeof window === "undefined" ? [] : read(),
}));

// Another tab starred someone: pick it up here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) useWatchlist.setState({ ids: read() });
  });
}

export function toggleWatch(id: number) {
  const { ids } = useWatchlist.getState();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  useWatchlist.setState({ ids: next });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the list lasts for this visit.
  }
}
