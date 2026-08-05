# Ghostkit

> **Archived:** Package source moved to the
> [`ferdousbhai/ghosts`](https://github.com/ferdousbhai/ghosts) monorepo under
> `packages/`. Existing npm releases remain available under the same
> `@summonghost/*` names. Do not open package changes here.

Reusable TypeScript packages for Cloudflare AI applications. Applications
bundle these packages into their own Worker; there is no shared runtime service
or network hop.

## Packages

- `@summonghost/memory` — canonical relationship-memory document contracts,
  tool/workflow schemas, and pure mutation/validation helpers.
- `@summonghost/compaction` — provider-neutral proactive/hard-limit conversation
  compaction controller and policy, plus an xAI-native adapter with
  consumer-injected authenticated transport.
- `@summonghost/research` — separate research tools, shared Exa/Reddit
  primitives, reusable Grok native-X execution and non-terminal `research_x`, public
  HTTPS URL admission, bounded response readers, and provider-neutral result
  pagination/cache primitives.
- `@summonghost/title-generation` — synchronous provisional labels plus
  provider-neutral small-model prompt construction and output validation.
- `@summonghost/context-documents` — pure Markdown normalization, metadata,
  prompt-formatting, and revision-reconciliation helpers.
- `@summonghost/feedback-context` — provider-neutral helpers for bounded,
  reviewable feedback overlays.
- `@summonghost/markdown-editor-react` — a small lazy-loaded Milkdown React
  editor with scoped, variable-driven styles.

## Commands

```sh
pnpm install
pnpm validate
```

Install only the packages an application needs:

```sh
pnpm add @summonghost/memory @summonghost/compaction @summonghost/title-generation
```

Package publication from this repository is disabled. Each consumer bundles the
imported code into its own Cloudflare Worker.

## Execution boundary

These are build-time packages only. Each application bundles the used code into
its own Worker; no request crosses to a Ghostkit service. Provider runtimes such
as Exa and Grok execute from the consuming Worker with consumer-injected
clients, models, or authenticated transports.

Relationship-memory execution follows its durable owner: Agent-owned work uses
a Fiber, while application-owned work uses a Cloudflare Workflow.
Conversation-context pre-compaction uses Agent fibers where it is a
single-Agent optimization, with a synchronous hard-limit fallback. Detached
sub-agents are reserved for delegated, model-driven jobs with their own
identity, progress, or UI.
