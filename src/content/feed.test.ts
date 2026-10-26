import { describe, expect, it } from "vitest";
import { filterContent, timeAgo } from "./feed";
import type { ContentEntry } from "./model";

const entry = (url: string, kind: ContentEntry["kind"]): ContentEntry => ({
  kind,
  source: "Fantasy Football Scout",
  url,
  title: url,
  summary: null,
  imageUrl: null,
  publishedAt: "2026-10-26T12:00:00Z",
});

it("filterContent keeps one kind, or everything for All", () => {
  const items = [entry("a", "article"), entry("v", "video")];
  expect(filterContent(items, "all")).toBe(items);
  expect(filterContent(items, "video").map((i) => i.url)).toEqual(["v"]);
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
