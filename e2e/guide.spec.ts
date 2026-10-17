import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ guide: true });

const step = (page: Page, title: string) => page.getByRole("dialog", { name: title });

test("the planner guide shows once, after the team loads", async ({ page, planner }) => {
  void planner;
  await expect(step(page, "Get to know your planner")).toBeVisible();
  await page.getByRole("button", { name: "Show me" }).click();
  await expect(step(page, "Tap a player")).toBeVisible();
  await expect(page.getByTestId("guide-finger")).toBeVisible();

  // The arrow keys step through the guide, not the gameweeks behind it.
  const gameweek = page.getByRole("navigation", { name: "Gameweek" });
  const before = await gameweek.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(step(page, "Hold and drag to sub")).toBeVisible();
  await expect(gameweek).toHaveText(before!);

  for (const title of ["Swipe between gameweeks", "Prefer tapping?", "Share your plan"]) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(step(page, title)).toBeVisible();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("planner-guide")).toHaveCount(0);

  await page.reload();
  await expect(gameweek).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("planner-guide")).toHaveCount(0);
});

test("skipping the guide, then replaying it from the account menu", async ({ page, planner }) => {
  void planner;
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByTestId("planner-guide")).toHaveCount(0);

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Planner guide" }).click();
  await expect(step(page, "Get to know your planner")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("planner-guide")).toHaveCount(0);
});
