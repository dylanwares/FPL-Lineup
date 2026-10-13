import type { Page } from "@playwright/test";
import { expect, stats, test, token } from "./fixtures";

/** Player names by id, from the same bootstrap file the app loads. */
async function names(page: Page): Promise<Record<number, string>> {
  const version = await (await page.request.get("/api/version")).json();
  const file = await (await page.request.get(version.url)).json();
  return Object.fromEntries(file.players.id.map((id: number, i: number) => [id, file.players.name[i]]));
}

const gwNumber = (page: Page) => page.getByRole("navigation", { name: "Gameweek" }).locator(".font-display");
const bench = (page: Page) => page.getByRole("region", { name: "Bench" });

test("imports a team and switches gameweeks without network requests", async ({ page, planner }) => {
  await expect(gwNumber(page)).toHaveText(String(planner.nextGw));
  await expect(stats(page)).toContainText("0/5");

  const requests: string[] = [];
  page.on("request", (r) => {
    if (!r.url().includes("/_next/")) requests.push(r.url());
  });
  await page.getByRole("button", { name: "Next gameweek" }).click();
  await expect(gwNumber(page)).toHaveText(String(planner.nextGw + 1));
  await page.getByRole("button", { name: "Previous gameweek" }).click();
  await expect(gwNumber(page)).toHaveText(String(planner.nextGw));
  expect(requests).toEqual([]);
});

test("sub mode: two taps swap a starter and a sub, and the armband follows", async ({ page, planner }) => {
  void planner;
  const n = await names(page);
  const sub = page.getByRole("button", { name: "Sub", exact: true });
  await sub.click();
  await expect(sub).toHaveAttribute("aria-pressed", "true");

  // Select the captain (a midfielder): the goalkeeper can't swap with him, the bench midfielder can.
  await token(page, n[12]).click();
  await expect(token(page, n[12])).toHaveAttribute("data-selected", "true");
  await expect(token(page, n[82])).toHaveAttribute("data-dimmed", "true");
  await expect(token(page, n[565])).not.toHaveAttribute("data-dimmed");

  await token(page, n[565]).click();
  await expect(page.getByRole("status").filter({ hasText: "armband" })).toContainText(
    `armband passed to ${n[565]}`,
  );
  await expect(bench(page).locator(`[data-player="${n[12]}"]`)).toBeVisible();
  await expect(sub).toHaveAttribute("aria-pressed", "true"); // mode stays on

  // Tapping the selected player again cancels.
  await token(page, n[8]).click();
  await expect(token(page, n[8])).toHaveAttribute("data-selected", "true");
  await token(page, n[8]).click();
  await expect(token(page, n[8])).not.toHaveAttribute("data-selected");
});

test("transfer mode: sell, buy, undo and reset", async ({ page, planner }) => {
  const n = await names(page);
  const transfer = page.getByRole("button", { name: "Transfer", exact: true });
  await transfer.click();

  await token(page, n[8]).click();
  const list = page.getByRole("dialog", { name: `Replace ${n[8]}` });
  await expect(list).toBeVisible();

  const first = list.locator("ul button").first();
  const bought = (await first.getAttribute("data-player")) ?? "";
  await first.click();
  await expect(list).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Sold" })).toContainText(
    `Sold ${n[8]}, bought ${bought}`,
  );
  await expect(token(page, bought)).toBeVisible();
  await expect(stats(page)).toContainText("1/5");
  await expect(transfer).toHaveAttribute("aria-pressed", "true");

  // The change carries forward to later gameweeks.
  await page.getByRole("button", { name: "Next gameweek" }).click();
  await expect(token(page, bought)).toBeVisible();
  await page.getByRole("button", { name: "Previous gameweek" }).click();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(token(page, n[8])).toBeVisible();
  await expect(stats(page)).toContainText("0/5");

  // Make it again, then Reset the gameweek.
  await token(page, n[8]).click();
  await list.locator("ul button").first().click();
  await expect(stats(page)).toContainText("1/5");
  await page.getByRole("button", { name: `Reset GW${planner.nextGw}` }).click();
  await expect(stats(page)).toContainText("0/5");
  await expect(token(page, n[8])).toBeVisible();
});

test("player list filters and explains dimmed players", async ({ page, planner }) => {
  void planner;
  const n = await names(page);
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await token(page, n[411]).click(); // a premium forward: plenty of budget
  const list = page.getByRole("dialog", { name: `Replace ${n[411]}` });

  const count = list.getByText(/^\d+ players?$/);
  const all = Number((await count.textContent())?.split(" ")[0]);
  expect(all).toBeGreaterThan(20);

  await list.getByRole("searchbox", { name: "Search players" }).fill("zzzz");
  await expect(list.getByText("No players match these filters.")).toBeVisible();
  await list.getByRole("searchbox", { name: "Search players" }).fill("");

  await list.getByRole("combobox", { name: "Maximum price" }).selectOption({ label: "Up to £5.0m" });
  const cheap = Number((await count.textContent())?.split(" ")[0]);
  expect(cheap).toBeLessThan(all);

  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
});

test("the player sheet starts a one-off sub or transfer for that player", async ({ page, planner }) => {
  void planner;
  const n = await names(page);
  const sub = page.getByRole("button", { name: "Sub", exact: true });
  const transfer = page.getByRole("button", { name: "Transfer", exact: true });

  // Substitute: the player is pre-selected, one tap swaps, then the mode switches off.
  await token(page, n[12]).click();
  await page.getByRole("dialog").getByRole("button", { name: "Substitute" }).click();
  await expect(token(page, n[12])).toHaveAttribute("data-selected", "true");
  await expect(page.getByRole("status").filter({ hasText: "swap with" })).toBeVisible();
  await token(page, n[565]).click();
  await expect(bench(page).locator(`[data-player="${n[12]}"]`)).toBeVisible();
  await expect(sub).toHaveAttribute("aria-pressed", "false");

  // Transfer: straight to the list; after buying, back to normal browsing.
  await token(page, n[8]).click();
  await page.getByRole("dialog").getByRole("button", { name: "Transfer" }).click();
  const list = page.getByRole("dialog", { name: `Replace ${n[8]}` });
  await list.locator("ul button").first().click();
  await expect(page.getByRole("status").filter({ hasText: "Sold" })).toContainText(`Sold ${n[8]}`);
  await expect(transfer).toHaveAttribute("aria-pressed", "false");

  // Cancelling a one-off transfer also leaves the mode.
  await token(page, n[277]).click();
  await page.getByRole("dialog").getByRole("button", { name: "Transfer" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(transfer).toHaveAttribute("aria-pressed", "false");
});
