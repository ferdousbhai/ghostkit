import { describe, expect, it } from "vitest";
import {
  canApplyConversationCompaction,
  conversationCompactionKey,
  decideConversationCompaction,
} from "./index.js";

const policy = {
  proactiveTokens: 80_000,
  hardLimitTokens: 100_000,
  headroomTokens: 5_000,
};

describe("conversation compaction policy", () => {
  it("schedules early, deduplicates pending work, and blocks only at the hard limit", () => {
    expect(
      decideConversationCompaction({ estimatedTokens: 70_000, policy }),
    ).toBe("none");
    expect(
      decideConversationCompaction({ estimatedTokens: 76_000, policy }),
    ).toBe("background");
    expect(
      decideConversationCompaction({
        estimatedTokens: 76_000,
        pending: true,
        policy,
      }),
    ).toBe("none");
    expect(
      decideConversationCompaction({
        estimatedTokens: 95_000,
        pending: true,
        policy,
      }),
    ).toBe("blocking");
  });

  it("creates stable scope-and-anchor keys", () => {
    expect(
      conversationCompactionKey({
        scope: "conversation/a",
        throughId: "message:9",
        revision: 4,
      }),
    ).toBe("conversation-compaction:conversation%2Fa:message%3A9:4");
  });

  it("applies only an anchored compaction that advances the checkpoint", () => {
    const currentMessageIds = ["a", "b", "c", "tail"];
    expect(
      canApplyConversationCompaction({
        expectedFromId: "a",
        expectedThroughId: "c",
        currentMessageIds,
      }),
    ).toBe(true);
    expect(
      canApplyConversationCompaction({
        expectedFromId: "a",
        expectedThroughId: "c",
        currentMessageIds,
        currentThroughId: "c",
      }),
    ).toBe(false);
    expect(
      canApplyConversationCompaction({
        expectedFromId: "missing",
        expectedThroughId: "c",
        currentMessageIds,
      }),
    ).toBe(false);
  });
});
