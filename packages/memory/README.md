# `@summonghost/memory`

Canonical relationship-memory contracts and pure mutation, normalization,
capacity, revision, and compaction-validation helpers.

```ts
import {
  applyRelationshipMemoryMutation,
  formatRelationshipMemoryContext,
} from "@summonghost/memory";

const updated = applyRelationshipMemoryMutation(existingMemory, {
  kind: "append",
  content: "- Prefers concise answers",
});

const promptContext = formatRelationshipMemoryContext(updated.content);
```

Storage and background execution remain application-owned, so consumers can use
Cloudflare D1, Durable Objects, Workflows, or another persistence layer without
adding a shared network hop.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
