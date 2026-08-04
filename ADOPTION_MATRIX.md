# Package adoption matrix

| Package                              | Version | SummonGhost           | Ask Dan               | GhostBuild            |
| ------------------------------------ | ------: | --------------------- | --------------------- | --------------------- |
| `@summonghost/memory`                | `0.1.3` | rollout prepared²     | rollout prepared²     | not applicable        |
| `@summonghost/compaction`            | `0.1.3` | rollout prepared²     | rollout prepared²     | rollout prepared²     |
| `@summonghost/research`              | `0.2.0` | adopted and verified  | adopted and verified  | not applicable        |
| `@summonghost/title-generation`      | `0.1.1` | rollout prepared¹     | not evaluated         | adopted through 0.1.0 |
| `@summonghost/context-documents`     | `0.1.0` | adopted and verified³ | adopted and verified³ | not applicable        |
| `@summonghost/markdown-editor-react` | `0.1.0` | adopted and verified³ | adopted and verified³ | not applicable        |
| `@summonghost/feedback-context`      | `0.1.0` | rollout prepared⁴     | rollout prepared⁴     | not evaluated         |

Each release is validated first from its packed artifact with lockfile
integrity checks, then adopted from the same npm version. SummonGhost uses the
xAI adapter and pagination/cache primitives; Ask Dan uses the provider-neutral
controller, relationship-memory contracts, and shared research capabilities.
Ask Dan does not invent an xAI compaction path because xAI is research-only
there. GhostBuild intentionally has no memory or research dependency.

¹ SummonGhost has been validated against the packed `0.1.1` artifact. Its
deployment adoption follows publication of this exact version.

² The `0.1.3` packed artifacts include blocking-replacement verification,
strict xAI usage/timeout handling, and final memory replay reconciliation.
Consumers remain pinned to `0.1.2` until publication and exact-version
adoption.

³ Both document packages are published at `0.1.0`, pinned to that exact version
in SummonGhost and Ask Dan, and pass their consumer suites. Storage,
authorization, and save orchestration remain consumer-owned.

⁴ The package renders compact reaction XML and decorates only temporary model
views. Reaction ingestion, authorization, external-message mapping,
persistence, and retention remain consumer-owned.
