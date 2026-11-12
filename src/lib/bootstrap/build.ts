import { createHash } from "node:crypto";
import { KITS } from "@/config/kits";
import { getRules } from "@/config/rules";
import type { BootstrapFile } from "@/data/format";
import type { Manifest } from "@/data/manifest";
import { fplApiSource } from "./fpl-api-source";
import type { DataSource, ProjectionSource, Projections } from "./sources";
import { buildBootstrap } from "./transform";
import { xpSource } from "./xp-source";

export interface BuiltBootstrap {
  file: BootstrapFile;
  /** The file, serialised once so every request can send it as is. */
  json: string;
  manifest: Manifest;
  warnings: string[];
}

export const bootstrapUrl = (hash: string) => `/api/bootstrap/${hash}`;

/** Content hash without the timestamp, so unchanged data keeps its URL and clients keep their cache. */
export function hashBootstrap(file: BootstrapFile): string {
  return createHash("sha256")
    .update(JSON.stringify({ ...file, generatedAt: 0 }))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Fetches live FPL data (and projections, when available) and builds the
 * bootstrap file plus the manifest that /api/version serves.
 */
export async function buildLiveBootstrap(
  sources: { game?: DataSource; projections?: ProjectionSource } = {},
): Promise<BuiltBootstrap> {
  const rules = getRules();
  const [game, projections] = await Promise.all([
    (sources.game ?? fplApiSource).load(),
    (sources.projections ?? xpSource(rules.lastGw)).load().catch((err: unknown): Projections | null => {
      console.warn(`bootstrap: projections unavailable (${String(err)}), continuing without`);
      return null;
    }),
  ]);

  const { file, warnings } = buildBootstrap(
    game,
    projections,
    rules,
    (code) => KITS[code],
    Math.floor(Date.now() / 1000),
  );
  const hash = hashBootstrap(file);
  return {
    file,
    json: JSON.stringify(file),
    manifest: {
      hash,
      url: bootstrapUrl(hash),
      season: file.season,
      currentGw: file.currentGw,
      nextGw: file.nextGw,
      generatedAt: file.generatedAt,
    },
    warnings,
  };
}
