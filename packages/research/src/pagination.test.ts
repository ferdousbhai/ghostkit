import { describe, expect, it } from "vitest";
import {
  createPaginationCache,
  paginateText,
  stablePaginationKey,
  type PaginationCacheEntry,
} from "./index.js";

describe("research pagination cache", () => {
  it("stores bounded entries in consumer-owned state", () => {
    let entries: readonly PaginationCacheEntry[] = [];
    const cache = createPaginationCache({
      getEntries: () => entries,
      now: () => 1_000,
      setEntries: (next) => {
        entries = next;
      },
    });

    cache.set("search:key", "full result text");

    expect(cache.get("search:key")).toBe("full result text");
    expect(entries).toEqual([
      {
        content: "full result text",
        createdAt: 1_000,
        key: "search:key",
      },
    ]);
  });

  it("expires and repairs malformed persisted entries", () => {
    let now = 1_000;
    let entries: unknown = [
      { content: "kept", createdAt: 900, key: "valid" },
      { content: "future", createdAt: 10_000, key: "future" },
      { content: 42, createdAt: 900, key: "malformed" },
    ];
    const cache = createPaginationCache({
      getEntries: () => entries,
      now: () => now,
      setEntries: (next) => {
        entries = next;
      },
      ttlMs: 500,
    });

    expect(cache.get("valid")).toBe("kept");
    expect(entries).toEqual([
      { content: "kept", createdAt: 900, key: "valid" },
    ]);

    now = 1_401;
    expect(cache.get("valid")).toBeNull();
    expect(entries).toEqual([]);
  });

  it("keeps recent entries and rejects oversized content", () => {
    let entries: readonly PaginationCacheEntry[] = [];
    let now = 1_000;
    const cache = createPaginationCache({
      getEntries: () => entries,
      maxCharacters: 10,
      maxEntries: 2,
      now: () => now++,
      setEntries: (next) => {
        entries = next;
      },
    });

    cache.set("a", "one");
    cache.set("b", "two");
    cache.set("c", "three");
    cache.set("large", "x".repeat(11));

    expect(entries.map((entry) => entry.key)).toEqual(["c", "b"]);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("large")).toBeNull();
  });

  it("builds stable keys independent of object property order", () => {
    expect(stablePaginationKey("web_search", { b: 2, a: ["x", "y"] })).toBe(
      stablePaginationKey("web_search", { a: ["x", "y"], b: 2 }),
    );
    expect(() => stablePaginationKey(" ", {})).toThrow(
      "pagination cache namespace is required",
    );
  });

  it("rejects non-JSON cache-key values instead of collapsing them", () => {
    expect(() => stablePaginationKey("search", { value: undefined })).toThrow(
      "pagination cache inputs must be JSON values",
    );
    expect(() => stablePaginationKey("search", { value: Number.NaN })).toThrow(
      "pagination cache inputs must contain finite numbers",
    );
    expect(() => stablePaginationKey("search", { value: new Date() })).toThrow(
      "pagination cache inputs must contain plain objects",
    );
    expect(() => stablePaginationKey("search", { value: Array(1) })).toThrow(
      "pagination cache inputs must not contain array holes",
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => stablePaginationKey("search", cyclic)).toThrow(
      "pagination cache inputs must not be cyclic",
    );
  });
});

describe("text pagination", () => {
  it("returns complete first pages without continuation metadata", () => {
    expect(paginateText("hello", { maxCharacters: 10 })).toEqual({
      content: "hello",
      end: 5,
      isFullFirstPage: true,
      partial: false,
      shownCharacters: 5,
      start: 0,
      totalCharacters: 5,
    });
  });

  it("clamps offsets and exposes forward and backward continuation points", () => {
    expect(
      paginateText("0123456789", {
        contentStart: 4,
        maxCharacters: 100,
        maximumPageCharacters: 3,
      }),
    ).toEqual({
      content: "456",
      end: 7,
      isFullFirstPage: false,
      nextStart: 7,
      partial: true,
      previousStart: 1,
      shownCharacters: 3,
      start: 4,
      totalCharacters: 10,
    });
    expect(
      paginateText("0123456789", {
        contentStart: 100,
        maxCharacters: 3,
      }).content,
    ).toBe("");
  });

  it("rejects invalid page limits", () => {
    expect(() => paginateText("hello", { maxCharacters: 0 })).toThrow(
      "maxCharacters must be a positive safe integer",
    );
    expect(() =>
      paginateText("hello", { contentStart: -1, maxCharacters: 1 }),
    ).toThrow("contentStart must be a non-negative safe integer");
    expect(() => paginateText("hello", { maxCharacters: 1.5 })).toThrow(
      "maxCharacters must be a positive safe integer",
    );
  });
});
