# Ghost Shared Packages

This repository contains build-time TypeScript packages shared by consuming
applications. Packages are bundled into each consumer; Ghostkit does not run a
shared network service.

## Boundaries

- Keep application authentication, billing, persona prompts, provider
  credentials, Durable Object classes, and database migrations in their owning
  applications.
- Core packages expose provider-neutral contracts and pure behavior.
- Provider-specific packages or modules may own reusable execution when their
  coupling is explicit. Consumers must inject configured provider clients or
  models; shared code must not read credentials or select an application's
  gateway.
- A package is adopted only by applications with a real product use for it.
- Consumer adoption must delete the superseded local implementation.

## Verification

- Run `pnpm validate` before handoff.
- Run consumer validation with packed package artifacts before publishing.
- Keep `SPEC_CHECKLIST.md`, `ADOPTION_MATRIX.md`, and `DELETION_LEDGER.md` current.
