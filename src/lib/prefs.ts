/** A remembered choice from localStorage, if it's still one of `valid`. */
export function readPref<T>(key: string, valid: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return valid.find((v) => String(v) === raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string | number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
}
