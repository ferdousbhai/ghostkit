import { createXai } from "@ai-sdk/xai";
import { describe, expect, it, vi } from "vitest";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});

import { createDelegatedXSearchTool } from "./x-search.js";

describe("delegated X search", () => {
  it("routes through the caller-selected Grok model and resumes with normalized results", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        items: [
          {
            author_handle: "@cloudflare",
            date: "2026-07-29",
            engagement: { likes: 42, reposts: 7 },
            text: "  Durable agents  ",
            url: "https://x.com/cloudflare/status/1",
          },
        ],
      },
    });
    const controller = new AbortController();
    const xai = createXai({ apiKey: "test-key" });
    const delegated = createDelegatedXSearchTool({
      model: xai.responses("grok-4.5"),
    });
    const execute = delegated.execute as (
      input: {
        query: string;
        from_date?: string;
        to_date?: string;
        depth: "quick" | "default" | "deep";
      },
      options: { abortSignal?: AbortSignal },
    ) => Promise<unknown>;

    await expect(
      execute(
        {
          depth: "quick",
          from_date: "2026-07-01",
          query: "Cloudflare agents",
          to_date: "2026-07-29",
        },
        { abortSignal: controller.signal },
      ),
    ).resolves.toEqual([
      {
        author: "cloudflare",
        date: "2026-07-29",
        likes: 42,
        reposts: 7,
        text: "Durable agents",
        url: "https://x.com/cloudflare/status/1",
      },
    ]);

    const call = generateTextMock.mock.calls[0]?.[0];
    expect(call.model.modelId).toBe("grok-4.5");
    expect(call.tools.x_search).toMatchObject({
      args: { fromDate: "2026-07-01", toDate: "2026-07-29" },
      id: "xai.x_search",
      type: "provider",
    });
    expect(call.prompt).toContain("Find 8-12 high-quality");
    controller.abort();
    expect(call.abortSignal.aborted).toBe(true);
  });
});
