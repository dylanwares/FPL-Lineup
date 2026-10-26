import { describe, expect, it } from "vitest";
import { appendPage, contentUrl, timeAgo } from "./feed";
import type { ContentEntry } from "./model";

const entry = (id: string): ContentEntry => ({
  id,
  kind: "article",
  source: "Fantasy Football Scout",
  url: `https://example.com/${id}`,
  title: id,
  summary: null,
  imageUrl: null,
  publishedAt: "2026-10-26T12:00:00Z",
});

it("contentUrl adds only the parameters in use", () => {
  expect(contentUrl("all")).toBe("/api/content");
  expect(contentUrl("video")).toBe("/api/content?kind=video");
  expect(contentUrl("article", "2026-10-26T12:00:00.000Z_abc")).toBe(
    "/api/content?kind=article&before=2026-10-26T12%3A00%3A00.000Z_abc",
  );
});

it("appendPage skips items already shown", () => {
  expect(appendPage([entry("a"), entry("b")], [entry("b"), entry("c")]).map((e) => e.id)).toEqual([
    "a",
    "b",
    "c",
  ]);
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  it.each([
    ["2026-10-26T11:59:30Z", "Just now"],
    ["2026-10-26T11:48:00Z", "12m"],
    ["2026-10-26T07:00:00Z", "5h"],
    ["2026-10-23T12:00:00Z", "3d"],
    ["2026-10-12T12:00:00Z", "12 Oct"],
  ])("%s → %s", (iso, label) => {
    expect(timeAgo(iso, now)).toBe(label);
  });
});
