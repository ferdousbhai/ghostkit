# Background execution decision

Choose the primitive from the durable state owner, not from retry or duration
requirements: use an Agent Fiber when the work belongs to one Agent, and use a
Workflow when it belongs to the application or another owner outside that
Agent.

## Relationship memory

The shared package does not choose the execution primitive. Use an Agent Fiber
when one Agent owns the relationship-memory request and lifecycle; use a
Workflow when the application owns them independently of any Agent.

In either case, the `remember` call awaits only durable acceptance. Compaction
and the canonical-document write run after the active turn. Stable operation
IDs, idempotent repository commits, and revision checks make retries safe. No
prompt-visible uncompacted tail exists; prompts read only the last committed
canonical document.

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
Because the conversation and its compaction checkpoint belong to that Agent,
stronger retry or completion requirements must be implemented through Fiber
recovery, idempotency, and the synchronous hard-limit fallback; they do not
change ownership or make the work a Workflow.

## Detached sub-agents

Do not use a detached sub-agent for compaction. Detached agent tools are for
delegated, model-driven work that benefits from a separate Agent identity, run
registry, progress, milestones, cancellation, or a result injected back into
chat.

References:

- https://developers.cloudflare.com/agents/runtime/execution/durable-execution/
- https://developers.cloudflare.com/agents/concepts/workflows/
- https://developers.cloudflare.com/agents/runtime/execution/agent-tools/
