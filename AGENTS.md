# Ghost Shared Packages

This repository contains build-time TypeScript packages shared by SummonGhost,
Ask Dan, and GhostBuild. Packages must not introduce runtime service calls.

## Boundaries

- Keep application authentication, billing, persona prompts, provider credentials,
  Durable Object classes, and database migrations in their owning applications.
- Shared packages expose provider-neutral contracts and pure behavior.
- A package is adopted only by applications with a real product use for it.
- Consumer adoption must delete the superseded local implementation.

## Verification

- Run `pnpm validate` before handoff.
- Run consumer validation with packed package artifacts before publishing.
- Keep `SPEC_CHECKLIST.md`, `ADOPTION_MATRIX.md`, and `DELETION_LEDGER.md` current.
