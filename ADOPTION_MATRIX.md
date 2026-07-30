# Package adoption matrix

| Package                         | Version | SummonGhost          | Ask Dan              | GhostBuild            |
| ------------------------------- | ------: | -------------------- | -------------------- | --------------------- |
| `@summonghost/memory`           | `0.1.3` | rollout prepared²    | rollout prepared²    | not applicable        |
| `@summonghost/compaction`       | `0.1.3` | rollout prepared²    | rollout prepared²    | rollout prepared²     |
| `@summonghost/research`         | `0.2.0` | adopted and verified | adopted and verified | not applicable        |
| `@summonghost/title-generation` | `0.1.1` | rollout prepared¹    | not evaluated        | adopted through 0.1.0 |

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
