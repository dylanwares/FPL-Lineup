import { expect, test } from "./fixtures";

const rows = (page: import("@playwright/test").Page) => page.locator("tr[data-team]");

test("the Fixtures tab opens in place, keeps the planner, and Back returns", async ({ page, planner }) => {
  // A full page load would drop this marker.
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  const gw = page.getByRole("navigation", { name: "Gameweek" });

  await page.getByRole("link", { name: "Fixtures" }).click();
  await expect(page).toHaveURL(/\/fixtures$/);
  await expect(page.getByRole("link", { name: "Fixtures" })).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(20);
  await expect(gw).toBeHidden();
  await expect(page).toHaveTitle(/^Fixtures/);
  await expect(page.getByText(`GW${planner.nextGw}–${planner.nextGw + 4}`)).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(gw).toBeVisible();
  await expect(rows(page).first()).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
});

test("ticker: 8 gameweeks, My squad filter and shifting the window", async ({ page, planner }) => {
  await page.getByRole("link", { name: "Fixtures" }).click();
  await expect(rows(page)).toHaveCount(20);

  await page.getByRole("button", { name: "8 GWs" }).click();
  await expect(rows(page).first().locator("td")).toHaveCount(8);

  // The fixture squad has players from 9 clubs; each row shows how many.
  await page.getByRole("button", { name: "My squad" }).click();
  await expect(rows(page)).toHaveCount(9);
  await expect(page.locator('tr[data-team="ARS"]')).toContainText("3");

  await page.getByRole("button", { name: "Later gameweeks" }).click();
  await expect(page.getByText(`GW${planner.nextGw + 1}–${planner.nextGw + 8}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Earlier gameweeks" })).toBeEnabled();
});

test("/fixtures loads directly, with My squad off until a team is connected", async ({ page }) => {
  await page.goto("/fixtures");
  await expect(rows(page)).toHaveCount(20);
  await expect(page.getByRole("button", { name: "My squad" })).toBeDisabled();

  await page.getByRole("link", { name: "Planner" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Your FPL team ID")).toBeVisible();
});
