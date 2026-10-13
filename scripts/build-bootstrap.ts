/**
 * Builds public/data/bootstrap.{hash}.json and src/data/generated/manifest.json.
 *
 *   pnpm data               always rebuild
 *   pnpm data --if-missing  skip when a manifest and its file already exist (used by predev)
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { KITS } from "../src/config/kits";
import { getRules } from "../src/config/rules";
import type { Manifest } from "../src/data/manifest";
import { fplApiSource } from "./lib/fpl-api-source";
import type { Projections } from "./lib/sources";
import { buildBootstrap } from "./lib/transform";
import { xpSource } from "./lib/xp-source";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const MANIFEST = path.join(ROOT, "src", "data", "generated", "manifest.json");

async function manifestIsUsable() {
  if (!existsSync(MANIFEST)) return false;
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as Manifest;
  return existsSync(path.join(ROOT, "public", manifest.url));
}

async function main() {
  if (process.argv.includes("--if-missing") && (await manifestIsUsable())) {
    console.log("bootstrap: existing data found, skipping (run `pnpm data` to refresh)");
    return;
  }

  const rules = getRules();
  const started = Date.now();

  const [game, projections] = await Promise.all([
    fplApiSource.load(),
    xpSource(rules.lastGw)
      .load()
      .catch((err: unknown): Projections | null => {
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
  for (const w of warnings) console.warn(`bootstrap: warning: ${w}`);

  const json = JSON.stringify(file);
  // Hash the content without the timestamp so unchanged data keeps its URL and clients keep their cache.
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...file, generatedAt: 0 }))
    .digest("hex")
    .slice(0, 12);
  const fileName = `bootstrap.${hash}.json`;

  await mkdir(DATA_DIR, { recursive: true });
  for (const old of await readdir(DATA_DIR)) {
    if (/^bootstrap\.[0-9a-f]+\.json$/.test(old) && old !== fileName) {
      await rm(path.join(DATA_DIR, old));
    }
  }
  await writeFile(path.join(DATA_DIR, fileName), json);

  const manifest: Manifest = {
    hash,
    url: `/data/${fileName}`,
    season: file.season,
    currentGw: file.currentGw,
    nextGw: file.nextGw,
    generatedAt: file.generatedAt,
  };
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `bootstrap: ${fileName} — ${file.players.id.length} players, ${file.fixtures.id.length} fixtures, ` +
      `${kb(json.length)} raw / ${kb(gzipSync(json).length)} gzip, ` +
      `GW current ${file.currentGw} next ${file.nextGw} (${Date.now() - started} ms)`,
  );
}

main().catch((err: unknown) => {
  console.error("bootstrap: failed:", err);
  process.exit(1);
});
