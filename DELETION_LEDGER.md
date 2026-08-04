# Deletion ledger

This ledger counts application production source only. It excludes tests,
fixtures, migrations, generated files, documentation, lockfiles, and vendored
package tarballs.

| Old implementation                                              | Replacement                                         | Consumer                | Status |  Production delta |
| --------------------------------------------------------------- | --------------------------------------------------- | ----------------------- | ------ | ----------------: |
| `src/lib/agent/memory-block.ts` pure memory helpers             | `@summonghost/memory`                               | SummonGhost             | done   |               -62 |
| Pure helpers/types in `src/lib/memory/relationship-memory.ts`   | `@summonghost/memory`                               | SummonGhost             | done   |   included below¹ |
| Ask Dan row-memory compaction/write logic                       | `@summonghost/memory` canonical document + Workflow | Ask Dan                 | done   |             +531² |
| Duplicate URL validation and response bounds                    | `@summonghost/research` primitives                  | SummonGhost, Ask Dan    | done   | included in audit |
| Combined `search_online` implementations                        | Separate `@summonghost/research` tools              | SummonGhost, Ask Dan    | done   | included in audit |
| Duplicate Exa request/result adapters                           | Shared Exa executor                                 | SummonGhost, Ask Dan    | done   | included in audit |
| Ask Dan Grok research and native-X runtime                      | Shared `@summonghost/research` Grok capability      | Ask Dan                 | done   | included in audit |
| Duplicate Reddit listing schemas and post normalization         | Shared Reddit parser                                | SummonGhost, Ask Dan    | done   | included in audit |
| Duplicate `remember` and memory-mutation schemas                | `@summonghost/memory` schemas                       | SummonGhost, Ask Dan    | done   | included in audit |
| Duplicate Ask Dan compaction instructions                       | `@dan/agent-core`                                   | Ask Dan                 | done   |                -6 |
| Duplicate context threshold/checkpoint helpers                  | `@summonghost/compaction`                           | all three               | done   | included in audit |
| Ask Dan effective-history and compaction scheduling state       | Shared provider-neutral compaction controller       | Ask Dan                 | done   | included in audit |
| xAI native compact/tokenize request and response helpers        | Shared xAI adapter with injected app transport      | SummonGhost             | done   | included in audit |
| Tool-result stable keys, bounded cache, and text pagination     | `@summonghost/research` primitives                  | SummonGhost             | done   | included in audit |
| Duplicate provisional/model title prompt and validation helpers | `@summonghost/title-generation`                     | SummonGhost, GhostBuild | done   | included in audit |
| SummonGhost Milkdown wrappers and shared editor styling         | `@summonghost/markdown-editor-react`                | SummonGhost, Ask Dan    | done   | included in audit |
| Markdown title/format and revision reconciliation helpers       | `@summonghost/context-documents`                    | SummonGhost, Ask Dan    | done   | included in audit |
| Duplicate reaction XML and model-view decoration policy         | `@summonghost/feedback-context`                     | SummonGhost, Ask Dan    | ready  |  pending adoption |

¹ The first SummonGhost adoption deletes 243 and adds 284 production lines
(net +41) when the new 126-line Workflow adapter is included. The shared
contract has removed local duplication, but the cross-repository deletion
target is not yet net-negative because both consumers also gained durable
Workflow infrastructure.

² Ask Dan's canonical-document migration replaces its row-per-fact behavior and
removes active-turn compaction latency, but it also adds the Workflow
contract/dispatcher/entrypoint and control-plane migration compatibility.

## Final source audit

| Repository                | Added | Deleted |  Net |
| ------------------------- | ----: | ------: | ---: |
| SummonGhost               |   737 |     538 | +199 |
| Ask Dan                   | 1,192 |     563 | +629 |
| GhostBuild                |   167 |       4 | +163 |
| Consumers                 | 2,096 |   1,105 | +991 |
| `ghostkit` package source |   866 |       0 | +866 |

The extraction removes 1,105 lines of consumer production code, including the
old combined-search helpers and local memory utilities. It is not net-negative:
the durable canonical-memory migration, Workflow retry/CAS infrastructure,
proactive background compaction, stale-result guards, billing, and distinct
application-owned research execution add more code than they replace.

That is a deliberate exception to the original deletion target, not a hidden
success metric. Further deletion should come from simplifying application
storage/admission adapters after the migration is proven in production, rather
than moving authentication, billing, or persistence into a shared runtime
service.
