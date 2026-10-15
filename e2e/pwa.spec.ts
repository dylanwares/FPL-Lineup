import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "allow" });

test("installable: manifest and icons are served", async ({ page }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "FPL Lineup", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) {
    const res = await page.request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
});

test("once opened, the planner and fixtures work offline", async ({ page, context, planner }) => {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Visit the ticker while online, as people would, so its code is cached too.
  await page.getByRole("link", { name: "Fixtures" }).click();
  await expect(page.locator("tr[data-team]")).toHaveCount(20);
  await page.getByRole("link", { name: "Planner" }).click();

  await context.setOffline(true);
  await page.reload();
  const gw = page.getByRole("navigation", { name: "Gameweek" }).locator(".font-display");
  await expect(gw).toHaveText(String(planner.nextGw));
  await page.getByRole("button", { name: "Next gameweek" }).click();
  await expect(gw).toHaveText(String(planner.nextGw + 1));

  await page.getByRole("link", { name: "Fixtures" }).click();
  await expect(page.locator("tr[data-team]")).toHaveCount(20);

  // Refreshing from FPL needs the network, and says so. (The fixture's mock would answer even offline.)
  await page.unroute("**/api/team/1");
  await page.getByRole("link", { name: "Planner" }).click();
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Refresh team from FPL" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn’t refresh" })).toContainText(
    "You're offline",
  );
  await context.setOffline(false);
});
