import { z } from "zod";
import type { RedditSearchInput } from "./index.js";

export const redditPostSchema = z
  .object({
    author: z.string().optional(),
    created_utc: z.number(),
    id: z.string(),
    num_comments: z.number().optional(),
    permalink: z.string(),
    score: z.number().optional(),
    selftext: z.string().optional(),
    subreddit: z.string(),
    title: z.string(),
  })
  .passthrough();

export const redditListingSchema = z
  .object({
    data: z.object({
      children: z
        .array(
          z.object({
            data: redditPostSchema,
          }),
        )
        .max(100),
    }),
  })
  .passthrough();

export type RedditPost = z.infer<typeof redditPostSchema>;

export type RedditSearchResult = Readonly<{
  author: string | null;
  comments: number;
  date: string;
  excerpt: string;
  score: number;
  subreddit: string;
  title: string;
  url: string;
}>;

export function buildRedditSearchQuery(
  input: Pick<RedditSearchInput, "query" | "subreddits">,
): string {
  return [
    input.query,
    input.subreddits?.length
      ? `(${input.subreddits.map((name) => `subreddit:${name}`).join(" OR ")})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildRedditSearchUrl(
  input: RedditSearchInput,
  endpoint = "https://www.reddit.com/search.json",
): URL {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: buildRedditSearchQuery(input),
    sort: input.sort,
    t: input.time_range,
    limit: String(input.num_results),
    raw_json: "1",
  }).toString();
  return url;
}

export function normalizeRedditPost(post: RedditPost): RedditSearchResult {
  return {
    author: post.author ?? null,
    comments: post.num_comments ?? 0,
    date: new Date(post.created_utc * 1_000).toISOString(),
    excerpt: post.selftext?.replace(/\s+/g, " ").trim().slice(0, 1_500) ?? "",
    score: post.score ?? 0,
    subreddit: post.subreddit,
    title: post.title,
    url: new URL(post.permalink, "https://www.reddit.com").toString(),
  };
}

export function parseRedditSearchResults(
  untrusted: unknown,
  limit: number,
): RedditSearchResult[] {
  const listing = redditListingSchema.parse(untrusted);
  return listing.data.children
    .slice(0, Math.max(0, limit))
    .map(({ data }) => normalizeRedditPost(data));
}
