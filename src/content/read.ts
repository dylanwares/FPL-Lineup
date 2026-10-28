const READ_KEY = "fpl-lineup:content-read";
/** The feed holds about a month of items; older ones can be forgotten. */
const MAX_READ = 500;

/** The URLs opened so far, oldest first. */
export function readOpened(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/** `opened` with `url` as the newest, keeping only the last MAX_READ. */
export const withOpened = (opened: string[], url: string) =>
  [...opened.filter((u) => u !== url), url].slice(-MAX_READ);

export function writeOpened(opened: string[]) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(opened));
  } catch {
    // Storage blocked: items stay dimmed for this visit only.
  }
}
