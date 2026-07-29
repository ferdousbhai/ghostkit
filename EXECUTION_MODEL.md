# Background execution decision

## Relationship memory

Use Cloudflare Workflows.

The `remember` call awaits only Workflow creation, which is the durable
acceptance boundary. Compaction and the canonical-document write run after the
active turn. Deterministic instance IDs, idempotent mutation operations, and
revision checks make retries safe. No prompt-visible uncompacted tail exists;
prompts read only the last committed canonical document.

## Conversation context

Use the shared threshold policy with application-owned provider adapters:

- schedule proactive compaction before the hard limit;
- continue the current turn with its existing context after durable acceptance;
- apply a completed summary only if its source anchor is still current;
- compact synchronously at the hard limit if background work is unavailable or
  unfinished.

Agent `startFiber()` is appropriate for this single-Agent optimization: it
stores a retained record before returning and keeps work alive after the
calling function ends. Recovery of an evicted closure is application-defined.
A Workflow is preferable if a particular conversation compaction must have
automatic retries and guaranteed completion rather than relying on the
hard-limit fallback.

## Detached sub-agents

Do not use a detached sub-agent for compaction. Detached agent tools are for
delegated, model-driven work that benefits from a separate Agent identity, run
registry, progress, milestones, cancellation, or a result injected back into
chat.

References:

- https://developers.cloudflare.com/agents/runtime/execution/durable-execution/
- https://developers.cloudflare.com/agents/concepts/workflows/
- https://developers.cloudflare.com/agents/runtime/execution/agent-tools/
