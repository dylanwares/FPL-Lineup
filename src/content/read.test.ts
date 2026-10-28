import { expect, it } from "vitest";
import { withOpened } from "./read";

it("adds a url as the newest, without repeating it", () => {
  expect(withOpened(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  expect(withOpened(["a", "b"], "a")).toEqual(["b", "a"]);
});

it("forgets the oldest once the list is full", () => {
  const full = Array.from({ length: 500 }, (_, i) => `u${i}`);
  const next = withOpened(full, "new");
  expect(next).toHaveLength(500);
  expect(next[0]).toBe("u1");
  expect(next.at(-1)).toBe("new");
});
