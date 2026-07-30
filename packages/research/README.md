# `@summonghost/research`

Reusable implementations, schemas, and result formatting for separate
`web_search`, `read_url`, `x_search`, and `reddit_search` tools.

```ts
import {
  executeExaSearch,
  formatWebSearchResults,
  webSearchInputSchema,
} from "@summonghost/research";

const input = webSearchInputSchema.parse({
  query: "Cloudflare Agents SDK background work",
  search_type: "auto",
});

const execution = await executeExaSearch(exa, input.query ?? "", input);
const modelContext = formatWebSearchResults(
  input.query ?? "",
  execution.results,
);
```

`executeExaSearch` owns Exa request mapping, content normalization, and common
result filtering. Applications retain query fan-out, billing, credentials, and
provenance.

## Paginated result snapshots

The package exports provider-neutral primitives for keeping a bounded,
short-lived full result while returning deterministic character pages:

```ts
import {
  createPaginationCache,
  paginateText,
  stablePaginationKey,
} from "@summonghost/research";

const cache = createPaginationCache({
  getEntries: () => agentState.toolPaginationCache,
  setEntries: (entries) =>
    setAgentState({ ...agentState, toolPaginationCache: entries }),
});

const key = stablePaginationKey("web_search", providerInput);
const fullResult = cache.get(key) ?? (await executeSearch(providerInput));
cache.set(key, fullResult);

const page = paginateText(fullResult, {
  contentStart: input.content_start,
  maxCharacters: input.max_characters,
  maximumPageCharacters: 128_000,
});
```

`createPaginationCache` does not import Agent or application state. Consumers
provide synchronous state accessors; Ghostkit validates, expires, repairs, and
bounds the stored string entries. XML or UI rendering stays with the consumer.

X research includes bounded contracts, structured native-X execution, and a
reusable non-terminal `research_x` tool. The consumer injects its configured
Grok model, so credentials, billing, gateway selection, and persona prompts
remain at the deployment boundary.

```ts
import {
  createGrokXResearchTool,
  GROK_X_RESEARCH_TOOL_NAME,
} from "@summonghost/research";

const tools = {
  [GROK_X_RESEARCH_TOOL_NAME]: createGrokXResearchTool({
    model: xai.responses("grok-4.5"),
    system: "Application-specific research guidance.",
  }),
};
```

The tool gives Grok the conversation, forces xAI's native X tool, and returns
cited findings to the primary model. The primary model remains the turn owner,
continues its tool loop, and can complete other requested actions. Applications
must not infer that a natural-language request is X-only.

Reddit helpers share query construction, listing validation, and post
normalization without forcing applications into one authentication or ranking
strategy.

The package also exposes two provider-neutral public-read boundaries:

```ts
import { assertPublicHttpsUrl, readBoundedText } from "@summonghost/research";

const url = assertPublicHttpsUrl(input.url);
const text = await readBoundedText(response, 2_000_000);
```

`assertPublicHttpsUrl` rejects non-HTTPS URLs, credentials, internal hostnames,
and private IP literals. It does not perform DNS resolution or make a network
request. Applications remain responsible for outbound transport security;
Cloudflare Workers provide the public-only egress boundary used by the current
consumers.

`readBoundedText` consumes an existing standards-based `Response` under a byte
limit. It does not initiate a request.
