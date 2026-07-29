# `@summonghost/research`

Schemas and result formatting for separate `web_search`, `read_url`,
`x_search`, and `reddit_search` tools.

```ts
import {
  formatWebSearchResults,
  webSearchInputSchema,
} from "@summonghost/research";

const input = webSearchInputSchema.parse({
  query: "Cloudflare Agents SDK background work",
  search_type: "auto",
});

const modelContext = formatWebSearchResults(input.query ?? "", results);
```

X search supports two explicit execution paths:

```ts
import {
  createDelegatedXSearchTool,
  createNativeXSearchTool,
} from "@summonghost/research";

// A Grok-backed main turn: no nested model call.
const nativeXSearch = createNativeXSearchTool();

// A non-Grok main turn: run native X search through a caller-selected Grok model.
const delegatedXSearch = createDelegatedXSearchTool({
  model: xai.responses("grok-4.5"),
});
```

Applications retain their own provider credentials, gateway routing, and model
selection. The package never silently selects a model.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
