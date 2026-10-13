import { readCachedBootstrap, writeCachedBootstrap } from "./db";
import { decodeBootstrap } from "./decode";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "./format";
import type { Manifest } from "./manifest";
import type { GameData } from "./model";

export interface LoadResult {
  data: GameData;
  hash: string;
  source: "cache" | "network";
  ms: number;
}

export interface LoadOptions {
  /** Called when a newer bootstrap is found after serving from cache. */
  onUpdate?: (result: LoadResult) => void;
  fetchImpl?: typeof fetch;
}

async function fetchVersion(fetchImpl: typeof fetch): Promise<Manifest> {
  const res = await fetchImpl("/api/version", { cache: "no-cache" });
  if (!res.ok) throw new Error(`/api/version failed with ${res.status}`);
  return res.json() as Promise<Manifest>;
}

async function download(manifest: Manifest, fetchImpl: typeof fetch): Promise<BootstrapFile> {
  // Content-hashed and immutable, so the HTTP cache can serve it too.
  const res = await fetchImpl(manifest.url);
  if (!res.ok) throw new Error(`${manifest.url} failed with ${res.status}`);
  const file = (await res.json()) as BootstrapFile;
  // Saving is best-effort: private mode or full storage shouldn't block planning.
  await writeCachedBootstrap(manifest.hash, file).catch(() => {});
  return file;
}

async function readCache() {
  try {
    const cached = await readCachedBootstrap();
    return cached?.file.format === BOOTSTRAP_FORMAT ? cached : null;
  } catch {
    return null;
  }
}

/**
 * Loads game data once per session. Serves the IndexedDB copy immediately when
 * there is one and checks /api/version in the background (stale-while-revalidate);
 * otherwise downloads the current file.
 */
export async function loadGameData(opts: LoadOptions = {}): Promise<LoadResult> {
  const fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  const t0 = performance.now();

  const cached = await readCache();
  if (cached) {
    const result: LoadResult = {
      data: decodeBootstrap(cached.file),
      hash: cached.hash,
      source: "cache",
      ms: performance.now() - t0,
    };
    void revalidate(cached.hash, fetchImpl).then(
      (fresh) => fresh && opts.onUpdate?.(fresh),
      () => {}, // offline or server down: keep using the cached copy
    );
    return result;
  }

  const manifest = await fetchVersion(fetchImpl);
  const file = await download(manifest, fetchImpl);
  return { data: decodeBootstrap(file), hash: manifest.hash, source: "network", ms: performance.now() - t0 };
}

async function revalidate(hash: string, fetchImpl: typeof fetch): Promise<LoadResult | null> {
  const manifest = await fetchVersion(fetchImpl);
  if (manifest.hash === hash) return null;
  const t0 = performance.now();
  const file = await download(manifest, fetchImpl);
  return { data: decodeBootstrap(file), hash: manifest.hash, source: "network", ms: performance.now() - t0 };
}
