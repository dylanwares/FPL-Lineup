import type { Page } from "@playwright/test";
import type { ContentEntry, ContentPage } from "../src/content/model";
import { expect, test } from "./fixtures";

// 40 items, alternating articles and videos, an hour apart; the API pages 30 at a time.
const ITEMS: ContentEntry[] = Array.from({ length: 40 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  kind: i % 2 ? "video" : "article",
  source: i % 2 ? "FPL Mate" : "Fantasy Football Scout",
  url: `https://example.com/item-${i}`,
  title: `${i % 2 ? "Video" : "Article"} ${i}`,
  summary: null,
  imageUrl: null,
  publishedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
}));

async function mockContent(page: Page) {
  await page.route("**/api/content*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const kind = params.get("kind");
    const items = ITEMS.filter((i) => !kind || i.kind === kind);
    const start = Number(params.get("before") ?? 0);
    const body: ContentPage = {
      items: items.slice(start, start + 30),
      nextCursor: start + 30 < items.length ? String(start + 30) : null,
    };
    return route.fulfill({ json: body });
  });
}

const cards = (page: Page) => page.getByRole("main").getByRole("listitem");

test("the Content tab lists articles and videos that open in a new tab", async ({ page }) => {
  await mockContent(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Content" }).click();

  await expect(page).toHaveURL(/\/content$/);
  await expect(page).toHaveTitle(/^Content/);
  await expect(cards(page)).toHaveCount(30);
  const first = page.getByRole("link", { name: /Article 0/ });
  await expect(first).toHaveAttribute("href", "https://example.com/item-0");
  await expect(first).toHaveAttribute("target", "_blank");
  await expect(first).toHaveAttribute("rel", "noopener noreferrer");

  // Scrolling to the end loads the rest.
  await cards(page).last().scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(40);
  await expect(page.getByText("You’re all caught up.")).toBeVisible();
});

test("Content filters to videos and remembers the choice", async ({ page }) => {
  await mockContent(page);
  await page.goto("/content");
  await page.getByRole("button", { name: "Videos" }).click();
  await expect(cards(page)).toHaveCount(20);
  await expect(page.getByRole("link", { name: /Article/ })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Videos" })).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page)).toHaveCount(20);
});
