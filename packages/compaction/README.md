# `@summonghost/compaction`

Provider-neutral policy helpers for deciding when conversation compaction should
run in the background and when it must block to preserve a model's hard context
limit.

```ts
import { decideConversationCompaction } from "@summonghost/compaction";

const action = decideConversationCompaction({
  estimatedTokens: 72_000,
  policy: {
    proactiveTokens: 64_000,
    hardLimitTokens: 96_000,
    headroomTokens: 8_000,
  },
});
```

The package also exports stable compaction keys and stale-write guards. It has no
runtime service or network dependency.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
