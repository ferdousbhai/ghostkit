import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHandoffToGrokTool,
  extractGrokHandoffText,
  GROK_HANDOFF_TOOL_NAME,
  grokXSearchHandoffInputSchema,
  runNativeXSearch,
  shouldRouteDirectlyToGrokXSearch,
} from "./index.js";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: generateTextMock,
}));

describe("Grok native X research", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("executes structured research with xAI's native X tool", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        items: [
          {
            author_handle: "cloudflare",
            date: "2026-07-29",
            engagement: { likes: 42, reposts: 7 },
            text: "Durable agents",
            url: "https://x.com/cloudflare/status/1",
          },
        ],
      },
      totalUsage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    } as never);

    const result = await runNativeXSearch({
      model: { modelId: "grok-4.5" } as never,
      nativeToolOptions: {
        fromDate: "2026-07-01",
        toDate: "2026-07-29",
      },
      prompt: "Search X for Cloudflare Agents.",
    });

    expect(result.items).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({ modelId: "grok-4.5" }),
        providerOptions: { xai: { store: false } },
        toolChoice: "required",
        tools: {
          x_search: expect.objectContaining({
            args: { fromDate: "2026-07-01", toDate: "2026-07-29" },
            id: "xai.x_search",
            type: "provider",
          }),
        },
      }),
    );
  });

  it("creates a handoff tool that returns Grok's final answer", async () => {
    generateTextMock.mockResolvedValue({
      text: "X users are discussing durable agent recovery.",
      totalUsage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
    } as never);
    const handoffTool = createHandoffToGrokTool({
      model: { modelId: "grok-4.5" } as never,
      system: "Application research guidance.",
    });

    const output = await handoffTool.execute?.(
      {
        allowed_x_handles: ["@cloudflare"],
        enable_image_understanding: true,
        instructions:
          "Find substantive discussion and summarize the main views.",
      },
      {
        messages: [
          {
            role: "user",
            content: "What are people on X saying about Cloudflare Agents?",
          },
        ],
        toolCallId: "handoff-1",
      } as never,
    );

    expect(output).toMatchObject({
      kind: "grok_x_search_handoff",
      text: "X users are discussing durable agent recovery.",
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: "user",
            content: "What are people on X saying about Cloudflare Agents?",
          },
        ],
        system: expect.stringContaining(
          "Find substantive discussion and summarize the main views.",
        ),
        toolChoice: "required",
        tools: {
          x_search: expect.objectContaining({
            args: expect.objectContaining({
              allowedXHandles: ["cloudflare"],
              enableImageUnderstanding: true,
            }),
            id: "xai.x_search",
            type: "provider",
          }),
        },
      }),
    );
  });

  it("validates the handoff and extracts its terminal result", () => {
    expect(
      grokXSearchHandoffInputSchema.safeParse({
        instructions: "Research current discussion and answer with citations.",
      }).success,
    ).toBe(true);
    expect(
      grokXSearchHandoffInputSchema.safeParse({
        allowed_x_handles: ["one"],
        excluded_x_handles: ["two"],
        instructions: "Research current discussion.",
      }).success,
    ).toBe(false);
    expect(
      grokXSearchHandoffInputSchema.safeParse({
        from_date: "2026-07-29",
        instructions: "Research current discussion.",
        to_date: "2026-07-01",
      }).success,
    ).toBe(false);
    expect(
      extractGrokHandoffText([
        {
          toolResults: [
            {
              output: {
                kind: "grok_x_search_handoff",
                text: "  Grok's cited final answer.  ",
              },
              toolName: GROK_HANDOFF_TOOL_NAME,
            },
          ],
        },
      ]),
    ).toBe("Grok's cited final answer.");
  });

  it("directly routes only explicit X research prompts", () => {
    for (const prompt of [
      "Search X for the latest Cloudflare Agents discussion.",
      "What are people on Twitter saying about NVDA?",
      "Summarize recent tweets about the launch.",
      "Read https://x.com/cloudflare/status/123 and find related X posts.",
    ]) {
      expect(
        shouldRouteDirectlyToGrokXSearch([{ role: "user", content: prompt }]),
      ).toBe(true);
    }
    for (const prompt of [
      "Explain the X API authentication model.",
      "Why is the native tool called x_search?",
      "What is a tweet?",
      "Solve for x in this equation.",
      "Search the web for Cloudflare Agents.",
      "What did Elon say about the launch?",
    ]) {
      expect(
        shouldRouteDirectlyToGrokXSearch([{ role: "user", content: prompt }]),
      ).toBe(false);
    }
  });
});
