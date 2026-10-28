import type { Page } from "@playwright/test";
import type { ContentEntry, ContentFeed } from "../src/content/model";
import { expect, test } from "./fixtures";

// 40 items, alternating articles and videos, an hour apart.
const ITEMS: ContentEntry[] = Array.from({ length: 40 }, (_, i) => ({
  kind: i % 2 ? "video" : "article",
  source: i % 2 ? "FPL Mate" : "Fantasy Football Scout",
  url: `https://example.com/item-${i}`,
  title: `${i % 2 ? "Video" : "Article"} ${i}`,
  summary: null,
  imageUrl: null,
  publishedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
}));

async function mockContent(page: Page) {
  const body: ContentFeed = { items: ITEMS };
  await page.route("**/api/content", (route) => route.fulfill({ json: body }));
}

const cards = (page: Page) => page.getByRole("main").getByRole("listitem");

test("the Content tab lists articles and videos that open in a new tab", async ({ page }) => {
  await mockContent(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Content" }).click();

  await expect(page).toHaveURL(/\/content$/);
  await expect(page).toHaveTitle(/^Content/);
  await expect(cards(page)).toHaveCount(40);
  const first = page.getByRole("link", { name: /Article 0/ });
  await expect(first).toHaveAttribute("href", "https://example.com/item-0");
  await expect(first).toHaveAttribute("target", "_blank");
  await expect(first).toHaveAttribute("rel", "noopener noreferrer");
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
