# `@summonghost/compaction`

Provider-neutral policy helpers and an xAI-native execution adapter for
conversation compaction.

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

The package also exports stable compaction keys and stale-write guards. It has
no runtime service and never owns provider credentials.

For stateful model loops, `createConversationCompactionController` owns
effective-history reconciliation and proactive-versus-blocking coordination.
Provider work stays behind injected callbacks:

```ts
const controller = createConversationCompactionController({
  policy,
  countInputTokens: ({ messages }) => tokenCounter(messages),
  createSnapshot: ({ messages, sequence }) =>
    summarizer({ messages, sequence }),
  applySnapshot: ({ snapshot }) => [renderSummary(snapshot)],
  scheduleCompaction: ({ run }) => backgroundQueue.enqueue(run),
});
```

The controller verifies that subsequent raw history extends the previously
observed prefix before appending only its suffix. Replaced, truncated, or
same-length-mutated history resets the effective view instead of reusing a stale
summary. If no scheduler is supplied, proactive compaction is skipped and the
controller waits for the blocking threshold.

Once proactive work is accepted, the controller keeps that source marked
pending for the lifetime of the observed history branch. This prevents repeated
background scheduling before the consumer applies its durable checkpoint.
Background runs are invalidated when their observed history branch is replaced,
and a failed run releases the pending marker so a later preparation may
reschedule it. Preparation calls are serialized inside each controller.

## xAI native compaction

`createXaiCompactionAdapter` owns xAI's `/tokenize-text` and
`/responses/compact` request bodies, opaque compaction-item validation, native
usage parsing, conservative preflight counting, and timeout signals. The
consumer injects an authenticated transport and therefore retains credentials,
gateway selection, request metadata, and billing:

```ts
import { createXaiCompactionAdapter } from "@summonghost/compaction";

const xaiCompaction = createXaiCompactionAdapter({
  request: ({ body, conversationId, path, signal }) =>
    fetch(`${configuredXaiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: configuredAuthorization,
        "content-type": "application/json",
        ...(conversationId && { "x-grok-conv-id": conversationId }),
      },
      body: JSON.stringify(body),
      signal,
    }),
});

const result = await xaiCompaction.compactInput({
  model: "grok-4.5",
  items: nativeResponsesInput,
  conversationId,
});
```

The transport contract never receives or discovers an application API key. It
receives only the provider path, JSON body, optional conversation identifier,
and an abort signal. Native checkpoint persistence and conversion from
application messages remain consumer concerns.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
