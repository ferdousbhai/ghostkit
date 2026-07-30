import ipaddr from "ipaddr.js";
import { z } from "zod";

export {
  DEFAULT_PAGINATION_CACHE_MAX_CHARACTERS,
  DEFAULT_PAGINATION_CACHE_MAX_ENTRIES,
  DEFAULT_PAGINATION_CACHE_TTL_MS,
  createPaginationCache,
  paginateText,
  stablePaginationKey,
  type PaginationCache,
  type PaginationCacheEntry,
  type TextPage,
} from "./pagination.js";
export {
  createDelegatedXSearchTool,
  createGrokXResearchTool,
  createHandoffToGrokTool,
  createNativeXSearchTool,
  extractGrokHandoffText,
  GROK_HANDOFF_TOOL_NAME,
  GROK_X_RESEARCH_RESULT_KIND,
  GROK_X_RESEARCH_TOOL_NAME,
  GROK_X_SEARCH_HANDOFF_RESULT_KIND,
  X_SEARCH_MAX_RESULTS,
  X_SEARCH_MAX_TEXT_CHARACTERS,
  grokXResearchInputSchema,
  grokXSearchHandoffInputSchema,
  runNativeXSearch,
  runNativeXSearchAnswer,
  shouldRouteDirectlyToGrokXSearch,
  xSearchInputSchema,
  xSearchOutputSchema,
  type CreateGrokXResearchToolOptions,
  type CreateHandoffToGrokToolOptions,
  type DelegatedXSearchOptions,
  type GrokXResearchInput,
  type GrokXResearchResult,
  type GrokXSearchHandoffInput,
  type GrokXSearchHandoffResult,
  type NativeXSearchAnswer,
  type NativeXSearchOptions,
  type NativeXSearchRun,
  type NativeXSearchToolOptions,
  type RunNativeXSearchAnswerOptions,
  type RunNativeXSearchOptions,
  type XSearchInput,
  type XSearchItem,
  type XSearchResult,
} from "./x-search.js";
export {
  executeExaSearch,
  type ExecuteExaSearchOptions,
  type ExaResearchResult,
  type ExaSearchExecution,
  type ExaSearchRequest,
} from "./exa-search.js";
export {
  buildRedditSearchQuery,
  buildRedditSearchUrl,
  normalizeRedditPost,
  parseRedditSearchResults,
  redditListingSchema,
  redditPostSchema,
  type RedditPost,
  type RedditSearchResult,
} from "./reddit.js";

const FORBIDDEN_PUBLIC_HOST_SUFFIXES = [
  ".home.arpa",
  ".internal",
  ".invalid",
  ".local",
  ".localhost",
  ".test",
];

export const WEB_SEARCH_TYPES = [
  "instant",
  "fast",
  "auto",
  "deep-lite",
  "deep",
  "deep-reasoning",
] as const;

export const WEB_SEARCH_CATEGORIES = [
  "general",
  "news",
  "publication",
  "company",
  "people",
  "personal_site",
  "financial_report",
] as const;

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional(),
);

const boundedDomains = z
  .array(z.string().trim().min(1).max(253))
  .min(1)
  .max(100)
  .optional();

export const webSearchInputSchema = z
  .strictObject({
    query: optionalTrimmedString.describe(
      "One search query; use queries for parallel searches.",
    ),
    queries: z
      .array(z.string().trim().min(1).max(2_000))
      .min(1)
      .max(5)
      .optional()
      .describe("Independent search queries to run in parallel."),
    search_type: z
      .enum(WEB_SEARCH_TYPES)
      .default("auto")
      .describe(
        "Exa search strategy. Use auto normally; deep modes trade latency and cost for broader research.",
      ),
    additional_queries: z
      .array(z.string().trim().min(1).max(2_000))
      .min(1)
      .max(5)
      .optional()
      .describe(
        "Extra planning queries for deep, deep-lite, or deep-reasoning search.",
      ),
    category: z
      .enum(WEB_SEARCH_CATEGORIES)
      .default("general")
      .describe("Optional source-category filter."),
    num_results: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(10)
      .describe("Results per query."),
    include_domains: boundedDomains.describe(
      "Only include results from these domains.",
    ),
    exclude_domains: boundedDomains.describe(
      "Exclude results from these domains.",
    ),
    user_location: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase())
      .optional()
      .describe(
        "Two-letter ISO country code for geographically relevant results.",
      ),
    moderation: z
      .boolean()
      .default(true)
      .describe("Ask the search provider to filter unsafe results."),
    from_date: z.iso.date().optional().describe("Earliest publication date."),
    to_date: z.iso.date().optional().describe("Latest publication date."),
    max_age_hours: z
      .number()
      .int()
      .min(-1)
      .max(876_000)
      .optional()
      .describe(
        "Maximum cached-content age. Zero always fetches fresh; -1 uses cached content only.",
      ),
    content_mode: z
      .enum(["highlights", "text", "summary"])
      .default("highlights")
      .describe(
        "Highlights minimize tokens; text returns a bounded page excerpt; summary asks Exa to synthesize each result.",
      ),
    max_characters: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(20_000)
      .describe("Maximum characters on this result page."),
    content_start: z
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .default(0)
      .describe("Character offset for continuing cached search results."),
  })
  .superRefine((value, context) => {
    if (!value.query && !value.queries?.length) {
      context.addIssue({
        code: "custom",
        message: "query or queries is required",
        path: ["query"],
      });
    }
    if (
      value.additional_queries?.length &&
      !["deep-lite", "deep", "deep-reasoning"].includes(value.search_type)
    ) {
      context.addIssue({
        code: "custom",
        message: "additional_queries requires a deep search type",
        path: ["additional_queries"],
      });
    }
  });

export const readUrlInputSchema = z.strictObject({
  urls: z
    .array(
      z
        .url()
        .max(4_096)
        .refine(
          (value) =>
            URL.canParse(value) && new URL(value).protocol === "https:",
          {
            message: "URL must use HTTPS",
          },
        ),
    )
    .min(1)
    .max(5)
    .describe("Public HTTPS pages to read. This tool does not search."),
  max_characters: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(20_000)
    .describe("Maximum returned characters per result page."),
  content_start: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .default(0)
    .describe("Character offset for continuing a long extracted result."),
});

export const redditSearchInputSchema = z.strictObject({
  query: z.string().trim().max(500).default(""),
  subreddits: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_]{1,50}$/),
    )
    .min(1)
    .max(10)
    .optional(),
  sort: z.enum(["relevance", "hot", "new", "top"]).default("relevance"),
  time_range: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("month"),
  num_results: z.number().int().min(1).max(50).default(15),
});

export type WebSearchInput = z.infer<typeof webSearchInputSchema>;
export type ReadUrlInput = z.infer<typeof readUrlInputSchema>;
export type RedditSearchInput = z.infer<typeof redditSearchInputSchema>;

export type ResearchResult = Readonly<{
  url: string;
  title?: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  summary?: string;
}>;

export function normalizeSearchQueries(input: {
  query?: string;
  queries?: readonly string[];
}): string[] {
  const parallel = input.queries?.map((query) => query.trim()).filter(Boolean);
  if (parallel?.length) return [...new Set(parallel)];
  const query = input.query?.trim();
  return query ? [query] : [];
}

export function mapExaCategory(
  category: WebSearchInput["category"] | "research",
):
  | "company"
  | "publication"
  | "news"
  | "personal site"
  | "financial report"
  | "people"
  | undefined {
  if (category === "general") return undefined;
  if (category === "research" || category === "publication") {
    return "publication";
  }
  if (category === "personal_site") return "personal site";
  if (category === "financial_report") return "financial report";
  return category;
}

const ADULT_LEAK_DOMAIN_PATTERN =
  /(?:^|\.)fapello\.com$|(?:^|\.)fappeningbook\.com$|(?:^|\.)thefappening(?:blog)?\.com$|(?:^|\.)leakedzone\.com$/i;
const ADULT_LEAK_TEXT_PATTERN =
  /\b(?:nude\s+leaks?|onlyfans\s+leaks?|fappening|leaked\s+(?:onlyfans|nudes?|photos?))\b/i;

export function isBlockedWebSearchResult(result: ResearchResult): boolean {
  let hostname = "";
  try {
    hostname = new URL(result.url).hostname.replace(/^www\./i, "");
  } catch {
    return true;
  }
  if (ADULT_LEAK_DOMAIN_PATTERN.test(hostname)) return true;
  return ADULT_LEAK_TEXT_PATTERN.test(
    [result.title, result.text, result.summary].filter(Boolean).join(" "),
  );
}

export function escapeResearchXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatWebSearchResults(
  query: string,
  results: readonly ResearchResult[],
): string {
  return formatResults("web_results", "source", results, { query });
}

export function formatReadUrlResults(
  results: readonly ResearchResult[],
): string {
  return formatResults("fetched_pages", "page", results, {
    count: String(results.length),
  });
}

function formatResults(
  root: string,
  child: string,
  results: readonly ResearchResult[],
  rootAttributes: Readonly<Record<string, string>>,
): string {
  const attributes = Object.entries(rootAttributes)
    .map(([name, value]) => `${name}="${escapeResearchXml(value)}"`)
    .join(" ");
  const lines = [`<${root}${attributes ? ` ${attributes}` : ""}>`];
  if (!results.length) {
    lines.push(
      root === "web_results" ? "  No results." : "  No content fetched.",
    );
  }
  for (const item of results) {
    const itemAttributes = [`url="${escapeResearchXml(item.url)}"`];
    if (item.publishedDate) {
      itemAttributes.push(`date="${escapeResearchXml(item.publishedDate)}"`);
    }
    if (item.author) {
      itemAttributes.push(`author="${escapeResearchXml(item.author)}"`);
    }
    lines.push(`  <${child} ${itemAttributes.join(" ")}>`);
    lines.push(
      `    <title>${escapeResearchXml(item.title || "Untitled")}</title>`,
    );
    const text = (item.text ?? item.summary)?.replace(/\s+/g, " ").trim();
    lines.push(
      `    <content>${escapeResearchXml(text || "No content extracted.")}</content>`,
    );
    lines.push(`  </${child}>`);
  }
  lines.push(`</${root}>`);
  return lines.join("\n");
}

export function assertPublicHttpsUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new ResearchBoundaryError("InvalidPublicUrl", { cause });
  }
  if (url.protocol !== "https:") {
    throw new ResearchBoundaryError("PublicUrlProtocolRejected");
  }
  if (url.username || url.password) {
    throw new ResearchBoundaryError("PublicUrlCredentialsRejected");
  }
  url.hash = "";
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    FORBIDDEN_PUBLIC_HOST_SUFFIXES.some((suffix) =>
      hostname.endsWith(suffix),
    ) ||
    (ipaddr.isValid(hostname) && !isPublicIpAddress(hostname))
  ) {
    throw new ResearchBoundaryError("PublicUrlDestinationRejected");
  }
  return url;
}

export async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new ResearchBoundaryError("InvalidPublicUrlResponseLimit");
  }
  const declared = response.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ResearchBoundaryError("PublicUrlResponseTooLarge");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ResearchBoundaryError("PublicUrlResponseTooLarge");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

class ResearchBoundaryError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ResearchBoundaryError";
  }
}

function isPublicIpAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address.replace(/^\[|\]$/g, ""));
    const normalized =
      parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address()
        : parsed;
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}
