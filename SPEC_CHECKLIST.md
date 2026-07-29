# Architecture specification checklist

Status values: `pending`, `in_progress`, `verified`, `not_met`.

| Requirement                                                                          | Status   | Evidence                                                          |
| ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| Shared capabilities are build-time packages with no runtime package-service call     | verified | Exact vendored package artifacts in all consumers                 |
| SummonGhost is the reference relationship-memory implementation                      | verified | Shared contract adopted and consumer suite passes                 |
| Ask Dan uses the same canonical-document memory architecture and `remember` contract | verified | Shared contract, D1 migration, and API/tool tests                 |
| Only the canonical memory document enters prompts; no prompt-visible tail            | verified | SummonGhost and Ask Dan prompt/pending tests                      |
| Relationship-memory compaction runs outside the active turn                          | verified | Cloudflare Workflows in both consumers                            |
| Workflow creation is awaited until durable acceptance                                | verified | Dispatch tests and Ask Dan workerd integration                    |
| Workflow steps and memory mutation application are idempotent                        | verified | Deterministic IDs, operation ledger, CAS, and replay tests        |
| Conversation compaction is proactive and background with a hard-limit fallback       | verified | Shared policy and consumer scheduling/fallback tests              |
| `x_search`, `web_search`, `read_url`, and `reddit_search` remain distinct            | verified | Research contract, registry, and tool-selection tests             |
| `web_search` does not accept URLs                                                    | verified | Strict shared schema and consumer tests                           |
| URL reads use one SSRF-resistant implementation                                      | verified | Shared safe-fetch security suite and Cloudflare public-only fetch |
| Provider-specific compaction behavior remains in application adapters                | verified | xAI, Workers AI, and Dan adapters                                 |
| GhostBuild does not gain memory or research dependencies                             | verified | Package/dependency audit                                          |
| Consumer production code is net-negative after the migration                         | not_met  | Durable migration adds more code than the deleted adapters        |

The final row is intentionally not marked complete. The extraction deletes
duplicate helpers and legacy search code, but canonical-memory migration,
Workflow dispatch/retry/CAS logic, fiber recovery, and accounting add new
correctness behavior. See `DELETION_LEDGER.md`.
