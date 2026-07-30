import { describe, expect, it } from "vitest";
import {
  MAX_RELATIONSHIP_MEMORY_LENGTH,
  RelationshipMemoryCapacityError,
  RelationshipMemoryConflictError,
  applyRelationshipMemoryMutation,
  assertExpectedRelationshipMemoryRevision,
  containsExactMemoryBlock,
  countMemoryOccurrences,
  executeRelationshipMemoryOperation,
  formatMemoryLines,
  formatRelationshipMemoryContext,
  mergeMemoryEntries,
  normalizeRelationshipMemoryDocument,
  parseMemoryBlock,
  relationshipMemoryMutationSchema,
  rememberInputSchema,
  shouldCompactRelationshipMemory,
  validateRelationshipMemoryCompaction,
  type RelationshipMemoryCommitInput,
  type RelationshipMemoryDocument,
  type RelationshipMemoryRepository,
} from "./index.js";

describe("@summonghost/memory", () => {
  it("shares the remember tool and workflow mutation contracts", () => {
    expect(
      rememberInputSchema.safeParse({ content: "Prefers concise replies." })
        .success,
    ).toBe(true);
    expect(
      rememberInputSchema.safeParse({
        content: "",
        replaces: "Prefers detailed replies.",
      }).success,
    ).toBe(true);
    expect(rememberInputSchema.safeParse({ content: "" }).success).toBe(false);
    expect(
      rememberInputSchema.safeParse({ content: "two\nmemories" }).success,
    ).toBe(false);
    expect(
      relationshipMemoryMutationSchema.safeParse({
        kind: "replace",
        oldText: "tea",
        newText: "coffee",
      }).success,
    ).toBe(true);
  });

  it("parses plain text and legacy JSON memory blocks", () => {
    expect(
      parseMemoryBlock("# Memory\n- Likes tea.\n* Uses metric units."),
    ).toEqual(["Likes tea.", "Uses metric units."]);
    expect(
      parseMemoryBlock(
        JSON.stringify([
          "Likes tea.",
          { key: "Units", value: "metric" },
          { invalid: true },
        ]),
      ),
    ).toEqual(["Likes tea.", "Units: metric"]);
  });

  it("merges memory entries case-insensitively and keeps the latest spelling", () => {
    expect(
      mergeMemoryEntries(
        ["Likes Tea.", "Uses metric units."],
        ["likes tea.", "Prefers concise replies."],
      ),
    ).toEqual(["likes tea.", "Uses metric units.", "Prefers concise replies."]);
    expect(formatMemoryLines(["likes   tea."])).toBe("- likes tea.");
  });

  it("normalizes line endings and trailing whitespace without flattening markdown", () => {
    expect(
      normalizeRelationshipMemoryDocument(
        "  - Likes tea.  \r\n\r\n- Uses metric. \r\n",
      ),
    ).toBe("- Likes tea.\n\n- Uses metric.");
  });

  it("recognizes exact blocks only at line boundaries", () => {
    expect(containsExactMemoryBlock("- Likes catering.", "cat")).toBe(false);
    expect(containsExactMemoryBlock("- Likes catering.\ncat", "cat")).toBe(
      true,
    );
  });

  it("counts exact text occurrences for safe replacement", () => {
    expect(countMemoryOccurrences("one two one", "one")).toBe(2);
    expect(countMemoryOccurrences("one", "missing")).toBe(0);
  });

  it("applies append and exact replacement mutations", () => {
    expect(
      applyRelationshipMemoryMutation("- Likes tea.", {
        kind: "append",
        content: "Uses metric units.",
      }),
    ).toEqual({
      content: "- Likes tea.\nUses metric units.",
      changed: true,
    });
    expect(
      applyRelationshipMemoryMutation("- Likes tea.", {
        kind: "replace",
        oldText: "tea",
        newText: "coffee",
      }),
    ).toEqual({
      content: "- Likes coffee.",
      changed: true,
    });
  });

  it("makes workflow retries idempotent without weakening first-attempt errors", () => {
    const mutation = {
      kind: "replace" as const,
      oldText: "tea",
      newText: "coffee",
    };
    expect(() =>
      applyRelationshipMemoryMutation("- Likes coffee.", mutation),
    ).toThrow("was not found");
    expect(
      applyRelationshipMemoryMutation("- Likes coffee.", mutation, {
        allowAlreadyApplied: true,
      }),
    ).toEqual({
      content: "- Likes coffee.",
      changed: false,
    });
  });

  it("enforces revision conflicts with the established error contract", () => {
    expect(() =>
      assertExpectedRelationshipMemoryRevision({ revision: 3 }, 2),
    ).toThrow("expected 2, actual 3");
  });

  it("formats escaped canonical memory for prompt context", () => {
    expect(formatRelationshipMemoryContext("- Likes <tea> & coffee.")).toBe(
      [
        "<relationship_memory>",
        "- Likes &lt;tea&gt; &amp; coffee.",
        "</relationship_memory>",
      ].join("\n"),
    );
  });

  it("enforces the compaction threshold", () => {
    expect(
      shouldCompactRelationshipMemory(
        "x".repeat(MAX_RELATIONSHIP_MEMORY_LENGTH - 1),
      ),
    ).toBe(false);
    expect(
      shouldCompactRelationshipMemory(
        "x".repeat(MAX_RELATIONSHIP_MEMORY_LENGTH),
      ),
    ).toBe(true);
    expect(() =>
      formatRelationshipMemoryContext(
        "x".repeat(MAX_RELATIONSHIP_MEMORY_LENGTH + 1),
      ),
    ).toThrow(`must be ${MAX_RELATIONSHIP_MEMORY_LENGTH} characters or fewer`);
  });

  it("validates complete, shorter compaction replacements", () => {
    expect(
      validateRelationshipMemoryCompaction({
        sourceContent: "- Likes tea.\n- Likes tea.",
        compactedContent: "- Likes tea.",
      }),
    ).toBe("- Likes tea.");
    expect(() =>
      validateRelationshipMemoryCompaction({
        sourceContent: "- Likes tea.",
        compactedContent: "- Likes tea.",
      }),
    ).toThrow("did not shorten");
  });

  it("reports the headroom required after compaction", () => {
    const error = new RelationshipMemoryCapacityError(
      MAX_RELATIONSHIP_MEMORY_LENGTH - 8,
      MAX_RELATIONSHIP_MEMORY_LENGTH + 1,
    );
    expect(error).toMatchObject({
      code: "relationship_memory_capacity",
      requiredReduction: 2,
      maxLength: MAX_RELATIONSHIP_MEMORY_LENGTH,
    });
  });

  it("executes mutation and compaction through repository-neutral ports", async () => {
    const repository = memoryRepository(
      "x".repeat(MAX_RELATIONSHIP_MEMORY_LENGTH - 5),
    );
    const result = await executeRelationshipMemoryOperation({
      repository,
      operationId: "remember-1",
      operation: {
        kind: "mutate",
        mutation: { kind: "append", content: "new preference" },
      },
      compactor: async ({ maximumLength, sourceContent }) => {
        expect(maximumLength).toBe(MAX_RELATIONSHIP_MEMORY_LENGTH - 1);
        expect(sourceContent).toContain("new preference");
        return "Condensed preferences including the new preference.";
      },
    });

    expect(result).toMatchObject({
      status: "applied",
      compacted: true,
      attempts: 1,
      document: { revision: 2 },
    });
    expect((await repository.read()).content).toContain("new preference");
  });

  it("retries compare-and-swap conflicts and recognizes durable replays", async () => {
    const repository = memoryRepository("- Likes tea.", 1);
    const input = {
      repository,
      operationId: "correct-1",
      operation: {
        kind: "mutate" as const,
        mutation: {
          kind: "replace" as const,
          oldText: "tea",
          newText: "coffee",
        },
      },
    };

    await expect(
      executeRelationshipMemoryOperation(input),
    ).resolves.toMatchObject({
      status: "applied",
      attempts: 2,
    });
    await expect(
      executeRelationshipMemoryOperation(input),
    ).resolves.toMatchObject({
      status: "already_applied",
    });
  });

  it("fails after the configured conflict budget", async () => {
    const repository = memoryRepository(
      "- Likes tea.",
      Number.POSITIVE_INFINITY,
    );
    await expect(
      executeRelationshipMemoryOperation({
        repository,
        operationId: "append-1",
        operation: {
          kind: "mutate",
          mutation: { kind: "append", content: "Uses metric units." },
        },
        maxAttempts: 2,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RelationshipMemoryConflictError>>({
        code: "relationship_memory_conflict",
        attempts: 2,
      }),
    );
  });

  it("reconciles a same-operation commit after the final conflict", async () => {
    let applied = false;
    const document: RelationshipMemoryDocument = {
      ownerId: "owner-1",
      visitorUserId: "visitor-1",
      content: "- Likes tea.",
      revision: 1,
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
    };
    const repository: RelationshipMemoryRepository = {
      async read() {
        return document;
      },
      async wasOperationApplied() {
        return applied;
      },
      async commit() {
        applied = true;
        return { status: "conflict" };
      },
    };

    await expect(
      executeRelationshipMemoryOperation({
        repository,
        operationId: "append-raced",
        operation: {
          kind: "mutate",
          mutation: { kind: "append", content: "- Likes coffee." },
        },
        maxAttempts: 1,
      }),
    ).resolves.toMatchObject({
      status: "already_applied",
      attempts: 1,
    });
  });
});

function memoryRepository(
  content: string,
  conflictsBeforeCommit = 0,
): RelationshipMemoryRepository {
  let document: RelationshipMemoryDocument = {
    ownerId: "owner-1",
    visitorUserId: "visitor-1",
    content,
    revision: 1,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
  let conflicts = 0;
  const applied = new Set<string>();

  return {
    async read() {
      return { ...document };
    },
    async wasOperationApplied(operationId) {
      return applied.has(operationId);
    },
    async commit(input: RelationshipMemoryCommitInput) {
      if (
        input.expectedRevision !== document.revision ||
        conflicts < conflictsBeforeCommit
      ) {
        conflicts += 1;
        return { status: "conflict" };
      }
      const now = "2026-07-29T00:00:01.000Z";
      document = {
        ...document,
        content: input.content,
        revision: document.revision + 1,
        updatedAt: now,
      };
      applied.add(input.operationId);
      return { status: "committed", document: { ...document } };
    },
  };
}
