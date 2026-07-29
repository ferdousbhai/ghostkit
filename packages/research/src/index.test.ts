import { describe, expect, it } from "vitest";
import {
  formatReadUrlResults,
  formatWebSearchResults,
  createNativeXSearchTool,
  isBlockedWebSearchResult,
  mapExaCategory,
  normalizeSearchQueries,
  readUrlInputSchema,
  redditSearchInputSchema,
  webSearchInputSchema,
  xSearchInputSchema,
} from "./index.js";

describe("research contracts", () => {
  it("keeps search queries and URL reads structurally separate", () => {
    expect(
      webSearchInputSchema.safeParse({ query: "cloudflare agents" }).success,
    ).toBe(true);
    expect(
      webSearchInputSchema.safeParse({ urls: ["https://example.com"] }).success,
    ).toBe(false);
    expect(
      readUrlInputSchema.safeParse({ urls: ["https://example.com"] }).success,
    ).toBe(true);
    expect(readUrlInputSchema.safeParse({ query: "example" }).success).toBe(
      false,
    );
  });

  it("exposes bounded Exa capabilities without coupling the contract to its SDK", () => {
    const parsed = webSearchInputSchema.parse({
      query: "durable workflows",
      search_type: "deep",
      content_mode: "text",
      max_age_hours: 0,
      additional_queries: ["workflow retries"],
    });
    expect(parsed.search_type).toBe("deep");
    expect(parsed.content_mode).toBe("text");
    expect(mapExaCategory("publication")).toBe("publication");
    expect(mapExaCategory("personal_site")).toBe("personal site");
    expect(parsed.moderation).toBe(true);
    expect(
      webSearchInputSchema.safeParse({
        query: "durable workflows",
        search_type: "fast",
        additional_queries: ["recovery"],
      }).success,
    ).toBe(false);
  });

  it("normalizes parallel queries and validates Reddit search", () => {
    expect(
      normalizeSearchQueries({ queries: [" one ", "one", "two"] }),
    ).toEqual(["one", "two"]);
    expect(
      redditSearchInputSchema.parse({
        query: "workers",
        subreddits: ["cloudflare"],
      }),
    ).toMatchObject({ sort: "relevance", time_range: "month" });
  });

  it("exposes separate delegated and provider-native X search contracts", () => {
    expect(
      xSearchInputSchema.parse({
        query: "Cloudflare Agents",
        from_date: "2026-07-01",
      }),
    ).toMatchObject({ depth: "default" });
    expect(
      xSearchInputSchema.safeParse({
        query: "Cloudflare Agents",
        from_date: "July 1",
      }).success,
    ).toBe(false);
    expect(createNativeXSearchTool({ fromDate: "2026-07-01" })).toMatchObject({
      args: { fromDate: "2026-07-01" },
      id: "xai.x_search",
      type: "provider",
    });
  });
});

describe("research result helpers", () => {
  it("filters malformed and known abusive results", () => {
    expect(isBlockedWebSearchResult({ url: "not a url" })).toBe(true);
    expect(
      isBlockedWebSearchResult({
        url: "https://fapello.com/example",
        title: "example",
      }),
    ).toBe(true);
    expect(
      isBlockedWebSearchResult({
        url: "https://developers.cloudflare.com",
        title: "Cloudflare",
      }),
    ).toBe(false);
  });

  it("formats escaped provider-neutral results", () => {
    expect(
      formatWebSearchResults("a & b", [
        {
          url: "https://example.com/?a=1&b=2",
          title: "<Example>",
          text: "one\n two",
        },
      ]),
    ).toContain('query="a &amp; b"');
    expect(
      formatReadUrlResults([{ url: "https://example.com", text: "page" }]),
    ).toContain('<fetched_pages count="1">');
  });
});
