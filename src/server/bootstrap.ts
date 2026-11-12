import "server-only";
import { cacheLife } from "next/cache";
import { buildLiveBootstrap } from "@/lib/bootstrap/build";
import type { Manifest } from "@/data/manifest";

/*
 * The game data every screen reads (players, fixtures, projections and which
 * gameweek is next). It is rebuilt from the live FPL API on the server and
 * cached, so a new gameweek, price changes and fresh stats reach clients
 * without a redeploy. Before, the file was only built at deploy time, so the
 * Fixtures tab and the spotlight stayed on whichever gameweek was next then.
 *
 * A failed rebuild throws and is not cached: the last good copy keeps serving
 * until FPL answers again.
 */
export async function getBootstrap(): Promise<{ json: string; manifest: Manifest }> {
  "use cache";
  // FPL moves to the next gameweek at its deadline; prices change once a day
  // and stats after each match, so a 15-minute refresh is plenty.
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  const { json, manifest, warnings } = await buildLiveBootstrap();
  for (const w of warnings) console.warn(`bootstrap: warning: ${w}`);
  return { json, manifest };
}
