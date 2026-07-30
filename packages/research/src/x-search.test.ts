import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGrokXResearchTool,
  GROK_X_RESEARCH_TOOL_NAME,
  grokXResearchInputSchema,
  runNativeXSearch,
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

  it("creates a non-terminal tool that returns Grok research to the primary model", async () => {
    generateTextMock.mockResolvedValue({
      text: "X users are discussing durable agent recovery.",
      totalUsage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
    } as never);
    const researchTool = createGrokXResearchTool({
      model: { modelId: "grok-4.5" } as never,
      system: "Application research guidance.",
    });

    const output = await researchTool.execute?.(
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
        toolCallId: "research-1",
      } as never,
    );

    expect(output).toMatchObject({
      kind: "grok_x_research",
      text: "X users are discussing durable agent recovery.",
    });
    expect(GROK_X_RESEARCH_TOOL_NAME).toBe("research_x");
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
    expect(generateTextMock.mock.calls[0]?.[0].system).toContain(
      "The primary model remains responsible for the final answer",
    );
  });

  it("validates the non-terminal research contract", () => {
    expect(
      grokXResearchInputSchema.safeParse({
        instructions: "Research current discussion and answer with citations.",
      }).success,
    ).toBe(true);
    expect(
      grokXResearchInputSchema.safeParse({
        allowed_x_handles: ["one"],
        excluded_x_handles: ["two"],
        instructions: "Research current discussion.",
      }).success,
    ).toBe(false);
    expect(
      grokXResearchInputSchema.safeParse({
        from_date: "2026-07-29",
        instructions: "Research current discussion.",
        to_date: "2026-07-01",
      }).success,
    ).toBe(false);
  });
});
