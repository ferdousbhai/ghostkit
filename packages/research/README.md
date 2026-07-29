# `@summonghost/research`

Provider-neutral schemas and result formatting for separate `web_search`,
`read_url`, and `reddit_search` tools.

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

The package defines contracts and formatting only. Applications retain their own
provider credentials and execution code.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
