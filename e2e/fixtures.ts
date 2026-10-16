import { test as base, expect, type Page } from "@playwright/test";
import { getRules } from "../src/config/rules";
import { buildTeamImport } from "../src/lib/fpl/build-import";
import type { FplBootstrapSlim, FplEntry, FplHistory, FplPicks, FplTransfer } from "../src/lib/fpl/types";
import entry1 from "../src/lib/fpl/__fixtures__/entry-1.json";

/**
 * Entry 1's real squad (names replaced), re-dated so the plan starts at the
 * app's current next gameweek. Squad: XI 82 | 8 277 114 | 124 154 12 368 |
 * 165 411 569, bench 302, 31, 565, 387. Captain 12, vice 154. 3 free transfers (Wildcard GW3 and Free Hit GW5 keep, not add).
 */
export async function mockTeam(page: Page) {
  const version = await (await page.request.get("/api/version")).json();
  const nextGw: number = version.nextGw;
  const bootstrap: FplBootstrapSlim = {
    ...(entry1.bootstrap as FplBootstrapSlim),
    events: entry1.bootstrap.events.map((e) => ({
      ...e,
      is_next: e.id === nextGw,
      is_current: e.id === nextGw - 1,
    })),
  };
  const team = buildTeamImport(
    {
      entry: { ...(entry1.entry as FplEntry), current_event: nextGw - 1 },
      history: entry1.history as FplHistory,
      transfers: entry1.transfers as FplTransfer[],
      picks: entry1.picks as FplPicks,
      bootstrap,
    },
    getRules(),
  );
  await page.route("**/api/team/1", (route) => route.fulfill({ json: team }));
  await page.route("**/api/team/1/picks/*", (route) =>
    route.fulfill({ status: 404, json: { error: "n/a" } }),
  );
  return team;
}

export const test = base.extend<{ planner: { nextGw: number } }>({
  // Named `provide` (not `use`) so the React hooks lint rule doesn't mistake it for a hook.
  planner: async ({ page }, provide) => {
    const team = await mockTeam(page);
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill("1");
    await page.getByRole("button", { name: "Load my team" }).click();
    await expect(page.getByRole("navigation", { name: "Gameweek" })).toBeVisible();
    await provide({ nextGw: team.planFromGw });
  },
});

export { expect };

/** A player token on the pitch or bench, by display name. */
export const token = (page: Page, name: string) => page.locator(`[data-player="${name}"]`);

export const stats = (page: Page) => page.locator("main .grid.grid-cols-3").first();
