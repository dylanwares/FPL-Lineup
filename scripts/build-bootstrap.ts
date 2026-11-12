/**
 * Builds the bootstrap from live FPL data and prints a summary and any
 * warnings (missing kits, chip windows that disagree with the rules config).
 *
 *   pnpm data
 *
 * The app itself builds and caches the same data on the server
 * (src/server/bootstrap.ts), so nothing here needs to run before dev or build.
 */
import { gzipSync } from "node:zlib";
import { buildLiveBootstrap } from "../src/lib/bootstrap/build";

async function main() {
  const started = Date.now();
  const { file, json, manifest, warnings } = await buildLiveBootstrap();
  for (const w of warnings) console.warn(`bootstrap: warning: ${w}`);

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `bootstrap: ${manifest.hash} — ${file.players.id.length} players, ${file.fixtures.id.length} fixtures, ` +
      `${kb(json.length)} raw / ${kb(gzipSync(json).length)} gzip, ` +
      `GW current ${file.currentGw} next ${file.nextGw} (${Date.now() - started} ms)`,
  );
}

main().catch((err: unknown) => {
  console.error("bootstrap: failed:", err);
  process.exit(1);
});
