import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHttpsUrl,
  buildRedditSearchQuery,
  buildRedditSearchUrl,
  executeExaSearch,
  formatReadUrlResults,
  formatWebSearchResults,
  createNativeXSearchTool,
  isBlockedWebSearchResult,
  mapExaCategory,
  normalizeSearchQueries,
  parseRedditSearchResults,
  readBoundedText,
  readUrlInputSchema,
  redditSearchInputSchema,
  webSearchInputSchema,
  xSearchInputSchema,
  xSearchOutputSchema,
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
    expect(
      readUrlInputSchema.safeParse({ urls: ["http://example.com"] }).success,
    ).toBe(false);
    expect(readUrlInputSchema.safeParse({ query: "example" }).success).toBe(
      false,
    );
  });

  it("bounds and validates X search contracts", () => {
    expect(
      xSearchOutputSchema.safeParse({
        items: [
          {
            author_handle: "@cloudflare",
            date: "2026-07-29",
            engagement: { likes: 42, reposts: 7 },
            text: "Durable agents",
            url: "https://x.com/cloudflare/status/1",
          },
        ],
      }),
    ).toMatchObject({
      success: true,
      data: {
        items: [{ author_handle: "cloudflare" }],
      },
    });
    for (const invalid of [
      { url: "not a URL" },
      { date: "yesterday" },
      { engagement: { likes: -1, reposts: 0 } },
    ]) {
      expect(
        xSearchOutputSchema.safeParse({
          items: [
            {
              author_handle: "cloudflare",
              date: "2026-07-29",
              engagement: { likes: 1, reposts: 0 },
              text: "Durable agents",
              url: "https://x.com/cloudflare/status/1",
              ...invalid,
            },
          ],
        }).success,
      ).toBe(false);
    }
    expect(
      xSearchOutputSchema.safeParse({
        items: Array.from({ length: 61 }, (_, index) => ({
          author_handle: "cloudflare",
          date: "2026-07-29",
          engagement: null,
          text: `post ${index}`,
          url: `https://x.com/cloudflare/status/${index}`,
        })),
      }).success,
    ).toBe(false);
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
  it("executes Exa request mapping and normalizes provider content", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [
        {
          id: "exa-1",
          url: "https://example.com/article",
          title: "Article",
          highlights: ["Useful", "context"],
        },
      ],
    });
    const execution = await executeExaSearch(
      { search } as never,
      "cloudflare agents",
      {
        category: "publication",
        content_mode: "highlights",
        num_results: 5,
        search_type: "deep",
      },
    );
    expect(search).toHaveBeenCalledWith(
      "cloudflare agents",
      expect.objectContaining({
        category: "publication",
        contents: { highlights: true },
        numResults: 5,
        type: "deep",
      }),
    );
    expect(execution).toEqual({
      providerResultCount: 1,
      results: [
        expect.objectContaining({
          id: "exa-1",
          text: "Useful context",
        }),
      ],
    });
  });

  it("shares Reddit query, URL, and result normalization", () => {
    const input = redditSearchInputSchema.parse({
      query: "agents",
      subreddits: ["cloudflare", "typescript"],
    });
    expect(buildRedditSearchQuery(input)).toBe(
      "agents (subreddit:cloudflare OR subreddit:typescript)",
    );
    expect(buildRedditSearchUrl(input).pathname).toBe("/search.json");
    expect(
      parseRedditSearchResults(
        {
          data: {
            children: [
              {
                data: {
                  author: "ghost",
                  created_utc: 1,
                  id: "post-1",
                  num_comments: 3,
                  permalink: "/r/cloudflare/comments/post-1/example",
                  score: 7,
                  selftext: "Example body",
                  subreddit: "cloudflare",
                  title: "Example",
                },
              },
            ],
          },
        },
        1,
      ),
    ).toEqual([
      expect.objectContaining({
        author: "ghost",
        title: "Example",
        url: "https://www.reddit.com/r/cloudflare/comments/post-1/example",
      }),
    ]);
  });

  it("rejects malformed provider results instead of inventing data", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [{ title: "Missing URL" }],
    });
    await expect(
      executeExaSearch({ search } as never, "agents", {}),
    ).rejects.toThrow();

    expect(() =>
      parseRedditSearchResults(
        {
          data: {
            children: [
              {
                data: {
                  author: "ghost",
                  created_utc: 1,
                  id: "post-1",
                  permalink: "/r/example/comments/post-1/example",
                  subreddit: "example",
                  title: "Missing metrics",
                },
              },
            ],
          },
        },
        1,
      ),
    ).toThrow();
    expect(() =>
      parseRedditSearchResults({ data: { children: [] } }, -1),
    ).toThrow("Reddit result limit must be a non-negative safe integer");
  });

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
    expect(
      isBlockedWebSearchResult({
        url: "https://example.com",
        summary: "leaked onlyfans photos",
      }),
    ).toBe(true);
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

describe("public URL boundaries", () => {
  it.each([
    "https://localhost/a",
    "https://service.internal/a",
    "https://127.0.0.1/a",
    "https://10.0.0.1/a",
    "https://169.254.169.254/a",
    "https://[::1]/a",
    "https://[fd00::1]/a",
    "http://example.com/a",
    "ftp://example.com/a",
    "https://user:secret@example.com/a",
  ])("rejects %s", (value) => {
    expect(() => assertPublicHttpsUrl(value)).toThrow();
  });

  it("accepts public HTTPS URLs and strips fragments", () => {
    expect(assertPublicHttpsUrl("https://example.com/a#secret")).toMatchObject({
      hash: "",
      hostname: "example.com",
    });
  });

  it("rejects oversized declared and streamed responses", async () => {
    await expect(
      readBoundedText(
        new Response("small", { headers: { "Content-Length": "100" } }),
        10,
      ),
    ).rejects.toMatchObject({ code: "PublicUrlResponseTooLarge" });
    await expect(
      readBoundedText(new Response("too much"), 3),
    ).rejects.toMatchObject({ code: "PublicUrlResponseTooLarge" });
  });
});
