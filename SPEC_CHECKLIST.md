# Architecture specification checklist

Status values: `pending`, `in_progress`, `verified`, `not_met`.

| Requirement                                                                          | Status   | Evidence                                                          |
| ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| Shared capabilities are build-time packages with no runtime package-service call     | verified | Published npm packages bundled into all consumers                 |
| SummonGhost is the reference relationship-memory implementation                      | verified | Shared contract adopted and consumer suite passes                 |
| Ask Dan uses the same canonical-document memory architecture and `remember` contract | verified | Shared contract, D1 migration, and API/tool tests                 |
| Only the canonical memory document enters prompts; no prompt-visible tail            | verified | SummonGhost and Ask Dan prompt/pending tests                      |
| Relationship-memory compaction runs outside the active turn                          | verified | Cloudflare Workflows in both consumers                            |
| Workflow creation is awaited until durable acceptance                                | verified | Dispatch tests and Ask Dan workerd integration                    |
| Workflow steps and memory mutation application are idempotent                        | verified | Deterministic IDs, operation ledger, CAS, and replay tests        |
| Conversation compaction is proactive and background with a hard-limit fallback       | verified | Shared controller and Ask Dan adapter/Fiber tests                 |
| `x_search`, `web_search`, `read_url`, and `reddit_search` remain distinct            | verified | Research contract, registry, and tool-selection tests             |
| `web_search` does not accept URLs                                                    | verified | Strict shared schema and consumer tests                           |
| URL reads share provider-neutral admission and response bounds                       | verified | Research primitives plus application-owned Worker fetch adapters  |
| Reusable non-terminal Grok research and native X execution are bundled from Ghostkit | verified | Shared runtime tests plus Ask Dan research/workflow tests         |
| Provider credentials, gateway construction, and persona prompts remain in apps       | verified | Consumers inject configured models into the shared runtime        |
| xAI native compaction semantics are reusable without application credentials         | verified | Shared adapter tests with consumer-injected transport             |
| Search-result pagination/cache is provider-neutral and bounded                       | verified | Shared state-agnostic cache, stable-key, and page tests           |
| App-specific compaction persistence and provider routing remain in applications      | verified | Shared xAI transport contract plus consumer-owned checkpoints     |
| GhostBuild does not gain memory or research dependencies                             | verified | Package/dependency audit                                          |
| Consumer production code is net-negative after the migration                         | not_met  | Durable migration adds more code than the deleted adapters        |
| Shared context-document behavior is storage- and provider-neutral                    | verified | Pure Markdown/revision package has no runtime dependencies        |
| Shared Markdown editor has no product or persistence policy                          | verified | React package exposes editor props and scoped CSS only            |
| Shared feedback overlays are model-view-only and provider-neutral                    | verified | Pure XML renderer/decorator; consumers own storage and ID mapping |

The final row is intentionally not marked complete. The extraction deletes
duplicate helpers and legacy search code, but canonical-memory migration,
Workflow dispatch/retry/CAS logic, fiber recovery, and accounting add new
correctness behavior. See `DELETION_LEDGER.md`.
