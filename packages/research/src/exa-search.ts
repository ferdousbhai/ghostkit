import {
  isBlockedWebSearchResult,
  mapExaCategory,
  type ResearchResult,
  type WebSearchInput,
} from "./index.js";
import { z } from "zod";

const exaResearchResultSchema = z
  .object({
    author: z.string().optional(),
    highlights: z.array(z.string()).optional(),
    id: z.string().optional(),
    publishedDate: z.string().optional(),
    summary: z.string().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
    url: z.url(),
  })
  .passthrough();

export type ExaSearchRequest = Readonly<{
  additional_queries?: readonly string[];
  category?: WebSearchInput["category"] | "research";
  content_mode?: WebSearchInput["content_mode"];
  exclude_domains?: readonly string[];
  from_date?: string;
  include_domains?: readonly string[];
  max_age_hours?: number;
  moderation?: boolean;
  num_results?: number;
  search_type?: WebSearchInput["search_type"];
  to_date?: string;
  user_location?: string;
}>;

export type ExaResearchResult = ResearchResult &
  Readonly<{
    id?: string;
  }>;

export type ExaSearchExecution = Readonly<{
  providerResultCount: number;
  results: readonly ExaResearchResult[];
}>;

export type ExecuteExaSearchOptions = Readonly<{
  abortMessage?: string;
  signal?: AbortSignal;
  textMaxCharacters?: number;
}>;

export type ExaSearchClient = Readonly<{
  search: (
    query: string,
    options: never,
  ) => Promise<Readonly<{ results: readonly unknown[] }>>;
}>;

/**
 * Execute one Exa query using the shared request mapping and result
 * normalization. Callers retain query fan-out, pagination, billing, formatting,
 * credentials, and provenance.
 */
export async function executeExaSearch(
  exa: ExaSearchClient,
  query: string,
  request: ExaSearchRequest,
  options: ExecuteExaSearchOptions = {},
): Promise<ExaSearchExecution> {
  const category = mapExaCategory(request.category ?? "general");
  const contents =
    request.content_mode === "summary"
      ? { summary: { query } }
      : request.content_mode === "text"
        ? { text: { maxCharacters: options.textMaxCharacters ?? 4_000 } }
        : { highlights: true as const };
  if (request.max_age_hours !== undefined) {
    Object.assign(contents, { maxAgeHours: request.max_age_hours });
  }

  const response = await waitForSignal(
    exa.search(query, {
      ...(category && { category }),
      ...(request.additional_queries?.length && {
        additionalQueries: [...request.additional_queries],
      }),
      ...(request.from_date && { startPublishedDate: request.from_date }),
      ...(request.to_date && { endPublishedDate: request.to_date }),
      ...(request.include_domains?.length && {
        includeDomains: [...request.include_domains],
      }),
      ...(request.exclude_domains?.length && {
        excludeDomains: [...request.exclude_domains],
      }),
      ...(request.user_location && { userLocation: request.user_location }),
      contents,
      moderation: request.moderation ?? true,
      numResults: request.num_results ?? 10,
      type: request.search_type ?? "auto",
    } as never),
    options.signal,
    options.abortMessage,
  );

  const providerResults = z
    .array(exaResearchResultSchema)
    .parse(response.results);
  return {
    providerResultCount: providerResults.length,
    results: providerResults
      .map((result) => ({
        ...result,
        text: result.text ?? result.highlights?.join(" ") ?? result.summary,
      }))
      .filter((result) => !isBlockedWebSearchResult(result)),
  };
}

async function waitForSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  abortMessage?: string,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    throw abortMessage ? new Error(abortMessage) : signal.reason;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(abortMessage ? new Error(abortMessage) : signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}
