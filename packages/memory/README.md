# `@summonghost/memory`

Canonical relationship-memory contracts and pure mutation, normalization,
capacity, revision, compaction-validation, and repository-neutral execution
helpers.

```ts
import {
  applyRelationshipMemoryMutation,
  executeRelationshipMemoryOperation,
  formatRelationshipMemoryContext,
  rememberInputSchema,
  relationshipMemoryMutationSchema,
} from "@summonghost/memory";

const remember = rememberInputSchema.parse(toolInput);
const workflowMutation = relationshipMemoryMutationSchema.parse({
  kind: "append",
  content: remember.content,
});
const updated = applyRelationshipMemoryMutation(existingMemory, {
  ...workflowMutation,
});

const promptContext = formatRelationshipMemoryContext(updated.content);

const result = await executeRelationshipMemoryOperation({
  repository: applicationOwnedRepository,
  operationId,
  operation: { kind: "mutate", mutation: workflowMutation },
  compactor: applicationOwnedCompactor,
});
```

Storage and background execution remain application-owned, so consumers can use
Cloudflare D1, Durable Objects, Workflows, Fibers, or another persistence layer
without adding a shared network hop. The application repository must commit the
new document and operation ID atomically; the shared executor supplies replay
detection, optimistic retries, compaction policy, and compaction validation.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
