import { describe, expect, it, vi } from "vitest";
import { fetchJson, FetchJsonError } from "./fetch-json";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe("fetchJson", () => {
  it("retries 5xx with backoff, then succeeds", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const sleep = vi.fn(async () => {});

    await expect(fetchJson("https://x", { fetchImpl, sleep })).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    const [first, second] = sleep.mock.calls.map((c) => (c as unknown as [number])[0]);
    expect(second).toBeGreaterThan(first);
  });

  it("does not retry a 404", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({}, 404));
    const err = await fetchJson("https://x", { fetchImpl, sleep: async () => {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    expect((err as FetchJsonError).status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honours Retry-After on 429", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(json([1]));
    const sleep = vi.fn(async () => {});
    await expect(fetchJson("https://x", { fetchImpl, sleep })).resolves.toEqual([1]);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries network errors and gives up after the limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network down"));
    await expect(fetchJson("https://x", { fetchImpl, retries: 2, sleep: async () => {} })).rejects.toThrow(
      "network down",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
