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
  await expect(stats(page)).toContainText("0/3");

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
  await expect(stats(page)).toContainText("1/3");
  await expect(transfer).toHaveAttribute("aria-pressed", "true");

  // The change carries forward to later gameweeks.
  await page.getByRole("button", { name: "Next gameweek" }).click();
  await expect(token(page, bought)).toBeVisible();
  await page.getByRole("button", { name: "Previous gameweek" }).click();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(token(page, n[8])).toBeVisible();
  await expect(stats(page)).toContainText("0/3");

  // Make it again, then Reset the gameweek.
  await token(page, n[8]).click();
  await list.locator("ul button").first().click();
  await expect(stats(page)).toContainText("1/3");
  await page.getByRole("button", { name: `Reset GW${planner.nextGw}` }).click();
  await expect(stats(page)).toContainText("0/3");
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

test("press, hold and drag a player onto another to sub them", async ({ page, planner }) => {
  void planner;
  await page.setViewportSize({ width: 412, height: 1100 }); // pitch and bench both on screen
  const n = await names(page);
  const centre = async (name: string) => {
    const box = (await token(page, name).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  /** Holds `from`, drags it over `to`, and returns a function that releases. */
  const dragOnto = async (from: string, to: string) => {
    const a = await centre(from);
    const b = await centre(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.waitForTimeout(350); // hold to pick up
    await page.mouse.move(b.x, b.y, { steps: 12 });
    return () => page.mouse.up();
  };

  // A quick tap still opens the player sheet.
  await token(page, n[8]).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Dropping on an illegal partner (the goalkeeper onto a midfielder) changes nothing.
  let release = await dragOnto(n[82], n[124]);
  await expect(token(page, n[124])).toHaveAttribute("data-dimmed", "true");
  await release();
  await expect(bench(page).locator(`[data-player="${n[82]}"]`)).toHaveCount(0);

  // The captain (a midfielder) onto the bench midfielder: legal targets stay bright, the drop swaps them.
  release = await dragOnto(n[12], n[565]);
  await expect(token(page, n[82])).toHaveAttribute("data-dimmed", "true");
  await expect(token(page, n[565])).not.toHaveAttribute("data-dimmed");
  await release();
  await expect(bench(page).locator(`[data-player="${n[12]}"]`)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "armband" })).toContainText(n[565]);
  await expect(page.getByRole("dialog")).toBeHidden(); // releasing didn't also tap the player
});

test("history lists this gameweek's changes and can remove one", async ({ page, planner }) => {
  const n = await names(page);
  const history = page.getByRole("region", { name: `History · GW${planner.nextGw}` });
  await expect(history).toContainText("No changes planned");

  // A transfer (via the sheet) and a captain change.
  await token(page, n[8]).click();
  await page.getByRole("dialog").getByRole("button", { name: "Transfer" }).click();
  const list = page.getByRole("dialog", { name: `Replace ${n[8]}` });
  const first = list.locator("ul button").first();
  const bought = (await first.getAttribute("data-player")) ?? "";
  await first.click();
  await token(page, n[154]).click();
  // dispatchEvent: in dev mode the Next.js badge sits over the sheet's bottom-left button.
  await page.getByRole("dialog").getByRole("button", { name: "Make captain" }).dispatchEvent("click");

  const rows = history.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(`${n[8]} → ${bought}`);
  await expect(rows.nth(1)).toContainText(`${n[154]} made captain`);
  await expect(history).toContainText("1 transfer");

  // Remove the transfer: the captain change stays, the player comes back.
  await history.getByRole("button", { name: `Remove: ${n[8]} → ${bought}` }).click();
  await expect(rows).toHaveCount(1);
  await expect(token(page, n[8])).toBeVisible();
  await expect(stats(page)).toContainText("0/3");

  // Undo brings it back; other gameweeks have their own (empty) history.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Next gameweek" }).click();
  await expect(page.getByRole("region", { name: `History · GW${planner.nextGw + 1}` })).toContainText(
    "No changes planned",
  );
});

test("history compacts repeated changes into the fewest steps", async ({ page, planner }) => {
  const n = await names(page);
  const history = page.getByRole("region", { name: `History · GW${planner.nextGw}` });
  const rows = history.getByRole("listitem");
  await page.getByRole("button", { name: "Sub", exact: true }).click();
  const swap = async (a: string, b: string) => {
    await token(page, a).click();
    await token(page, b).click();
  };

  // Swap the same pair back and forth: four swaps cancel out entirely.
  for (let i = 0; i < 2; i++) {
    await swap(n[8], n[31]);
    await swap(n[31], n[8]);
  }
  await expect(history).toContainText("No changes planned");

  // A fifth swap leaves exactly one step.
  await swap(n[8], n[31]);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`${n[8]} ⇄ ${n[31]}`);
});

test("chips: play, move a planned chip, undo and cancel", async ({ page, planner }) => {
  // Entry 1 used its first-half Bench Boost (GW2), Wildcard (GW3) and Free Hit (GW5).
  test.skip(planner.nextGw + 2 > 19, "needs the first-half chip window");
  const chip = (name: string) => page.locator(`[data-chip="${name}"]`);
  const next = page.getByRole("button", { name: "Next gameweek" });
  const prev = page.getByRole("button", { name: "Previous gameweek" });

  await expect(chip("wildcard")).toBeDisabled();
  await expect(chip("wildcard")).toContainText("Used GW3");

  // Plan Triple Captain two gameweeks ahead.
  await next.click();
  await next.click();
  await chip("3xc").click();
  await expect(chip("3xc")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText(`Triple Captain played in GW${planner.nextGw + 2}`);

  // Earlier in the same half it reads as planned, but can still be tapped to move it.
  await prev.click();
  await prev.click();
  await expect(chip("3xc")).toContainText(`Planned GW${planner.nextGw + 2}`);
  await expect(chip("3xc")).toBeEnabled();
  await chip("3xc").click();
  await expect(page.getByRole("status")).toContainText(
    `Triple Captain moved from GW${planner.nextGw + 2} to GW${planner.nextGw}`,
  );
  await expect(chip("3xc")).toHaveAttribute("aria-pressed", "true");

  // Undo puts it back where it was.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(chip("3xc")).toContainText(`Planned GW${planner.nextGw + 2}`);

  // A second tap on a played chip cancels it.
  await next.click();
  await next.click();
  await chip("3xc").click();
  await expect(chip("3xc")).toHaveAttribute("aria-pressed", "false");
  await expect(chip("3xc")).toContainText("Available");
});

test("named plans: new, switch, duplicate, rename, delete with undo", async ({ page, planner }) => {
  const n = await names(page);
  const planButton = page.getByRole("button", { name: /Switch plan/ });
  const history = page.getByRole("region", { name: `History · GW${planner.nextGw}` });
  const options = page.getByRole("button", { name: "More options" });
  await expect(planButton).toContainText("Main plan");

  // One change in the main plan.
  await page.getByRole("button", { name: "Sub", exact: true }).click();
  await token(page, n[8]).click();
  await token(page, n[31]).click();
  await page.getByRole("button", { name: "Sub", exact: true }).click();
  await expect(history.getByRole("listitem")).toHaveCount(1);

  // New asks for a name first; Cancel creates nothing.
  await page.getByRole("button", { name: "New plan" }).click();
  await expect(page.getByRole("dialog")).toContainText("Name your plan");
  await page.getByRole("button", { name: "Cancel" }).click();
  await planButton.click();
  await expect(page.getByRole("listbox", { name: "Plans" }).getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Then starts blank from the squad.
  await page.getByRole("button", { name: "New plan" }).click();
  await page.getByLabel("Plan name").fill("Wildcard route");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(planButton).toContainText("Wildcard route");
  await expect(history).toContainText("No changes planned");

  // Switch back with the dropdown.
  await planButton.click();
  const list = page.getByRole("listbox", { name: "Plans" });
  await expect(list.getByRole("option")).toHaveCount(2);
  await expect(list.getByRole("option", { name: /Main plan/ })).toContainText("1 change");
  await list.getByRole("option", { name: /Main plan/ }).click();
  await expect(planButton).toContainText("Main plan");
  await expect(history.getByRole("listitem")).toHaveCount(1);

  // Duplicate keeps the moves; rename it.
  await options.click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(planButton).toContainText("Main plan copy");
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await options.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Plan name").fill("Free hit GW18");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(planButton).toContainText("Free hit GW18");

  // Delete asks first, then offers Undo.
  await options.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete “Free hit GW18”?");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status")).toContainText("Deleted Free hit GW18");
  await expect(planButton).not.toContainText("Free hit GW18");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(planButton).toContainText("Free hit GW18");

  // The open plan is remembered on the device.
  await page.reload();
  await expect(page.getByRole("button", { name: /Switch plan/ })).toContainText("Free hit GW18");
  await page.getByRole("button", { name: /Switch plan/ }).click();
  await expect(page.getByRole("listbox", { name: "Plans" }).getByRole("option")).toHaveCount(3);
});

test("account menu changes FPL team; ⋯ menu refreshes the team", async ({ page, planner }) => {
  void planner;
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Refresh team from FPL" }).click();
  await expect(page.getByRole("status")).toContainText("Team refreshed from FPL");

  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu", { name: "Account" });
  await expect(menu).toContainText("FPL team ID 1");
  // A tap outside closes it.
  await page.getByRole("navigation", { name: "Gameweek" }).click({ position: { x: 5, y: 5 } });
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Account" }).click();
  await menu.getByRole("menuitem", { name: "Change FPL team" }).click();
  await expect(page.getByLabel("Your FPL team ID")).toBeVisible();
});
