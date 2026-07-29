import { describe, expect, it } from "vitest";
import {
  MAX_RELATIONSHIP_MEMORY_LENGTH,
  RelationshipMemoryCapacityError,
  applyRelationshipMemoryMutation,
  assertExpectedRelationshipMemoryRevision,
  containsExactMemoryBlock,
  countMemoryOccurrences,
  formatMemoryLines,
  formatRelationshipMemoryContext,
  mergeMemoryEntries,
  normalizeRelationshipMemoryDocument,
  parseMemoryBlock,
  shouldCompactRelationshipMemory,
  validateRelationshipMemoryCompaction,
} from "./index.js";

describe("@summonghost/memory", () => {
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
});
