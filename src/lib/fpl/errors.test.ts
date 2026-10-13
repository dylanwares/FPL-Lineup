import { describe, expect, it } from "vitest";
import { FetchJsonError } from "@/lib/fetch-json";
import { TeamImportError } from "./build-import";
import { fplErrorResponse, parseEntryId } from "./errors";

/** How an error looks after crossing a `use cache` boundary: plain Error, name and message kept. */
function serialised(err: Error) {
  const plain = new Error(err.message);
  plain.name = err.name;
  return plain;
}

describe("fplErrorResponse", () => {
  it("maps a missing team to 404, whether or not the error crossed the cache", async () => {
    const err = new FetchJsonError("GET https://x/entry/9/ failed with 404", "https://x", 404);
    for (const e of [err, serialised(err)]) {
      const res = fplErrorResponse(e);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No FPL team found with that ID." });
    }
  });

  it("explains FPL's update window", () => {
    const err = new FetchJsonError("GET https://x failed with 503", "https://x", 503);
    expect(fplErrorResponse(serialised(err)).status).toBe(503);
  });

  it("passes import errors through and hides anything else", async () => {
    expect(fplErrorResponse(new TeamImportError("Season over", 409)).status).toBe(409);
    expect(fplErrorResponse(new TypeError("boom")).status).toBe(502);
  });
});

describe("parseEntryId", () => {
  it("accepts positive integers only", () => {
    expect(parseEntryId("123")).toBe(123);
    for (const bad of ["0", "-1", "1.5", "abc", "12345678901", ""]) expect(parseEntryId(bad)).toBeNull();
  });
});
