import { describe, expect, it } from "vitest";
import { bootstrapUrl, buildLiveBootstrap } from "./build";
import type { SourceData } from "./sources";

function game(nextGw: number): SourceData {
  return {
    events: Array.from({ length: 38 }, (_, i) => ({
      gw: i + 1,
      deadline: 1_790_000_000 + i * 604_800,
      finished: i + 1 < nextGw - 1,
      isCurrent: i + 1 === nextGw - 1,
      isNext: i + 1 === nextGw,
    })),
    teams: [{ id: 1, code: 3, name: "Arsenal", short: "ARS" }],
    players: [],
    fixtures: [],
    chips: [],
  };
}

const sources = (nextGw: number) => ({
  game: { name: "test", load: async () => game(nextGw) },
  projections: { name: "test", load: async () => new Map() },
});

describe("buildLiveBootstrap", () => {
  it("reports the source's current and next gameweek in the manifest", async () => {
    const { manifest, json } = await buildLiveBootstrap(sources(11));
    expect(manifest.currentGw).toBe(10);
    expect(manifest.nextGw).toBe(11);
    expect(manifest.url).toBe(bootstrapUrl(manifest.hash));
    expect(JSON.parse(json).nextGw).toBe(11);
  });

  it("changes hash when the gameweek moves on, so clients download the new data", async () => {
    const [a, b, c] = await Promise.all([
      buildLiveBootstrap(sources(9)),
      buildLiveBootstrap(sources(9)),
      buildLiveBootstrap(sources(11)),
    ]);
    expect(a.manifest.hash).toBe(b.manifest.hash);
    expect(c.manifest.hash).not.toBe(a.manifest.hash);
  });

  it("builds without projections when they fail to load", async () => {
    const failing = { name: "down", load: () => Promise.reject(new Error("offline")) };
    const { manifest, warnings } = await buildLiveBootstrap({ ...sources(11), projections: failing });
    expect(manifest.nextGw).toBe(11);
    expect(warnings.some((w) => w.includes("No projections"))).toBe(true);
  });
});
