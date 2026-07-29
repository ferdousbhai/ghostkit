# Ghostkit

Build-time TypeScript packages shared by SummonGhost, Ask Dan, and GhostBuild.
Applications bundle these packages into their own Cloudflare Worker; there is no
shared runtime service or network hop.

## Packages

- `@summonghost/memory` — canonical relationship-memory document contracts and pure
  mutation/validation helpers.
- `@summonghost/compaction` — provider-neutral proactive/hard-limit conversation
  compaction policy, stable deduplication keys, and stale-write guards.
- `@summonghost/research` — separate `web_search`, `read_url`, and `reddit_search`
  schemas plus provider-neutral result normalization and formatting.
- `@summonghost/safe-fetch` — bounded public-URL validation, redirect revalidation,
  and streamed response readers.

## Commands

```sh
pnpm install
pnpm validate
```

Install only the packages an application needs:

```sh
pnpm add @summonghost/memory @summonghost/compaction
```

The packages are published from this repository through npm trusted publishing.
Each consumer bundles the imported code into its own Cloudflare Worker.

## Execution boundary

These are build-time packages only. Each application bundles the used code into
its own Worker; no request crosses to a shared runtime service.

Relationship-memory compaction is application-owned Cloudflare Workflow work.
Conversation-context pre-compaction uses Agent fibers where it is a
single-Agent optimization, with a synchronous hard-limit fallback. Detached
sub-agents are reserved for delegated, model-driven jobs with their own
identity, progress, or UI.
