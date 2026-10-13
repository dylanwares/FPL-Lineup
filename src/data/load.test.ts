import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbConnection } from "./db";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "./format";
import { loadGameData, type LoadResult } from "./load";
import type { Manifest } from "./manifest";

function file(players: number): BootstrapFile {
  const ids = Array.from({ length: players }, (_, i) => i + 1);
  return {
    format: BOOTSTRAP_FORMAT,
    season: "2026-27",
    generatedAt: 0,
    currentGw: 1,
    nextGw: 2,
    events: { deadline: [1, 2], finished: [1, 0] },
    teams: {
      id: [1],
      code: [3],
      name: ["Arsenal"],
      short: ["ARS"],
      kit: [["plain", "#f00", "#fff", "#ff0"]],
    },
    players: {
      id: ids,
      code: ids,
      name: ids.map((i) => `P${i}`),
      team: ids.map(() => 1),
      pos: ids.map(() => 3),
      price: ids.map(() => 50),
      status: "a".repeat(players),
      chance: ids.map(() => -1),
      news: ids.map(() => ""),
      form: ids.map(() => 0),
      sel: ids.map(() => 0),
      pts: ids.map(() => 0),
    },
    fixtures: { id: [], gw: [], h: [], a: [], hd: [], ad: [], ko: [], fin: [], hs: [], as: [] },
    xp: { gws: 2, values: ids.flatMap(() => [-1, -1]) },
  };
}

/** A fake server: /api/version returns the current manifest, /data/* the matching file. */
function server(initial: { hash: string; file: BootstrapFile }) {
  let current = initial;
  let online = true;
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    if (!online) throw new TypeError("offline");
    const url = String(input);
    if (url === "/api/version") {
      const manifest: Manifest = {
        hash: current.hash,
        url: `/data/bootstrap.${current.hash}.json`,
        season: "2026-27",
        currentGw: 1,
        nextGw: 2,
        generatedAt: 0,
      };
      return Response.json(manifest);
    }
    if (url === `/data/bootstrap.${current.hash}.json`) return Response.json(current.file);
    return new Response(null, { status: 404 });
  });
  return {
    fetchImpl,
    publish(next: { hash: string; file: BootstrapFile }) {
      current = next;
    },
    goOffline() {
      online = false;
    },
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
});

describe("loadGameData", () => {
  it("downloads on first visit, then serves from IndexedDB", async () => {
    const srv = server({ hash: "aaa", file: file(3) });

    const first = await loadGameData({ fetchImpl: srv.fetchImpl });
    expect(first.source).toBe("network");
    expect(first.data.players).toHaveLength(3);

    const second = await loadGameData({ fetchImpl: srv.fetchImpl });
    expect(second.source).toBe("cache");
    expect(second.hash).toBe("aaa");
    expect(second.data.players).toHaveLength(3);
  });

  it("serves the cached copy and reports a newer version in the background", async () => {
    const srv = server({ hash: "aaa", file: file(3) });
    await loadGameData({ fetchImpl: srv.fetchImpl });
    srv.publish({ hash: "bbb", file: file(5) });

    const update = new Promise<LoadResult>((resolve) => {
      void loadGameData({ fetchImpl: srv.fetchImpl, onUpdate: resolve }).then((r) => {
        expect(r.source).toBe("cache");
        expect(r.data.players).toHaveLength(3);
      });
    });
    const fresh = await update;
    expect(fresh.hash).toBe("bbb");
    expect(fresh.data.players).toHaveLength(5);

    const third = await loadGameData({ fetchImpl: srv.fetchImpl });
    expect(third).toMatchObject({ source: "cache", hash: "bbb" });
  });

  it("works offline once cached", async () => {
    const srv = server({ hash: "aaa", file: file(3) });
    await loadGameData({ fetchImpl: srv.fetchImpl });
    srv.goOffline();
    const onUpdate = vi.fn();
    const r = await loadGameData({ fetchImpl: srv.fetchImpl, onUpdate });
    expect(r.source).toBe("cache");
    await new Promise((r) => setTimeout(r, 10));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("fails with no cache and no network", async () => {
    const srv = server({ hash: "aaa", file: file(3) });
    srv.goOffline();
    await expect(loadGameData({ fetchImpl: srv.fetchImpl })).rejects.toThrow("offline");
  });
});
