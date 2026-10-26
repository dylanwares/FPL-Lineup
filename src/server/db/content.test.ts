import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  existingContentUrls,
  listContent,
  pruneContent,
  upsertContent,
  type NewContentItem,
} from "./content";
import { testDb } from "./test-db";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());
beforeEach(async () => {
  await db.execute(sql`truncate content_items`);
});

const item = (n: number, over: Partial<NewContentItem> = {}): NewContentItem => ({
  source: "ffscout",
  kind: "article",
  url: `https://example.com/${n}`,
  title: `Item ${n}`,
  summary: null,
  imageUrl: null,
  // Item n is n hours old.
  publishedAt: new Date(Date.UTC(2026, 9, 26, 12) - n * 3_600_000),
  ...over,
});

describe("upsertContent", () => {
  it("adds new items and counts only those", async () => {
    expect(await upsertContent(db, [item(1), item(2)])).toBe(2);
    expect(await upsertContent(db, [item(1), item(3)])).toBe(1);
    const { items } = await listContent(db, { limit: 10 });
    expect(items.map((i) => i.title)).toEqual(["Item 1", "Item 2", "Item 3"]);
  });

  it("refreshes titles but keeps the first publish date and a known image", async () => {
    await upsertContent(db, [item(1, { imageUrl: "https://img/1.jpg" })]);
    await upsertContent(db, [item(1, { title: "Edited", publishedAt: new Date(), imageUrl: null })]);
    const [row] = (await listContent(db, { limit: 10 })).items;
    expect(row).toMatchObject({ title: "Edited", imageUrl: "https://img/1.jpg" });
    expect(row.publishedAt).toEqual(item(1).publishedAt);
  });

  it("does nothing for no items", async () => {
    expect(await upsertContent(db, [])).toBe(0);
  });
});

describe("listContent", () => {
  it("pages newest first until the end", async () => {
    await upsertContent(
      db,
      Array.from({ length: 5 }, (_, i) => item(i)),
    );
    const first = await listContent(db, { limit: 2 });
    expect(first.items.map((i) => i.title)).toEqual(["Item 0", "Item 1"]);
    const second = await listContent(db, { limit: 2, before: decodeCursor(first.nextCursor!)! });
    expect(second.items.map((i) => i.title)).toEqual(["Item 2", "Item 3"]);
    const third = await listContent(db, { limit: 2, before: decodeCursor(second.nextCursor!)! });
    expect(third.items.map((i) => i.title)).toEqual(["Item 4"]);
    expect(third.nextCursor).toBeNull();
  });

  it("breaks publish-time ties by id, so a page boundary skips nothing", async () => {
    const at = new Date(Date.UTC(2026, 9, 26));
    await upsertContent(
      db,
      [1, 2, 3].map((n) => item(n, { publishedAt: at })),
    );
    const first = await listContent(db, { limit: 2 });
    const second = await listContent(db, { limit: 2, before: decodeCursor(first.nextCursor!)! });
    const urls = [...first.items, ...second.items].map((i) => i.url);
    expect(new Set(urls).size).toBe(3);
  });

  it("filters by kind", async () => {
    await upsertContent(db, [item(1), item(2, { kind: "video" })]);
    const { items } = await listContent(db, { kind: "video", limit: 10 });
    expect(items.map((i) => i.title)).toEqual(["Item 2"]);
  });
});

describe("cursors", () => {
  it("round-trips and rejects junk", () => {
    const c = { publishedAt: new Date("2026-10-26T12:00:00Z"), id: crypto.randomUUID() };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("nope")).toBeNull();
    expect(decodeCursor(`2026-10-26T12:00:00Z_not-a-uuid`)).toBeNull();
    expect(decodeCursor(`yesterday_${c.id}`)).toBeNull();
  });
});

it("existingContentUrls finds stored URLs", async () => {
  await upsertContent(db, [item(1)]);
  expect(await existingContentUrls(db, [item(1).url, item(2).url])).toEqual(new Set([item(1).url]));
  expect(await existingContentUrls(db, [])).toEqual(new Set());
});

it("pruneContent deletes items published before the cutoff", async () => {
  await upsertContent(db, [item(1), item(48)]);
  expect(await pruneContent(db, new Date(Date.UTC(2026, 9, 25, 12)))).toBe(1);
  const { items } = await listContent(db, { limit: 10 });
  expect(items.map((i) => i.title)).toEqual(["Item 1"]);
});
