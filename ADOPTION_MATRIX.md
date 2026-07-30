# Package adoption matrix

| Package                         | Version | SummonGhost          | Ask Dan              | GhostBuild           |
| ------------------------------- | ------: | -------------------- | -------------------- | -------------------- |
| `@summonghost/memory`           | `0.1.2` | adopted and verified | adopted and verified | not applicable       |
| `@summonghost/compaction`       | `0.1.2` | adopted and verified | controller adopted   | policy adopted       |
| `@summonghost/research`         | `0.1.4` | adopted and verified | adopted and verified | not applicable       |
| `@summonghost/title-generation` | `0.1.0` | adopted and verified | not evaluated        | adopted and verified |

Each release is validated first from its packed artifact with lockfile
integrity checks, then adopted from the same npm version. SummonGhost uses the
xAI adapter and pagination/cache primitives; Ask Dan uses the provider-neutral
controller, relationship-memory contracts, and shared research capabilities.
Ask Dan does not invent an xAI compaction path because xAI is research-only
there. GhostBuild intentionally has no memory or research dependency.
