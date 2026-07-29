import { xSearch } from "@ai-sdk/xai";
import { generateText, Output, tool, type LanguageModel, type Tool } from "ai";
import { z } from "zod";

const DEFAULT_X_SEARCH_TIMEOUT_MS = 120_000;

export const xSearchInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(2_000),
  from_date: z.iso.date().optional(),
  to_date: z.iso.date().optional(),
  depth: z.enum(["quick", "default", "deep"]).default("default"),
});

const xSearchEngagementSchema = z
  .strictObject({
    likes: z.number().nullable(),
    reposts: z.number().nullable(),
  })
  .nullable();

export const xSearchOutputSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      text: z.string().describe("Full text of the X post."),
      url: z.string().describe("Direct URL to the X post."),
      author_handle: z
        .string()
        .nullable()
        .describe("Author handle without @ when known."),
      date: z
        .string()
        .nullable()
        .describe("Post date as YYYY-MM-DD when known."),
      engagement: xSearchEngagementSchema,
    }),
  ),
});

export type XSearchInput = z.infer<typeof xSearchInputSchema>;
export type XSearchItem = z.infer<typeof xSearchOutputSchema>["items"][number];

export type XSearchResult = Readonly<{
  text: string;
  url: string;
  author: string;
  date: string | null;
  likes: number | null;
  reposts: number | null;
}>;

export type NativeXSearchOptions = NonNullable<Parameters<typeof xSearch>[0]>;

export function createNativeXSearchTool(
  options: NativeXSearchOptions = {},
): ReturnType<typeof xSearch> {
  return xSearch(options);
}

export interface DelegatedXSearchOptions {
  /**
   * An xAI Responses model. The caller owns credentials, gateway routing, model
   * selection, and billing; Ghostkit deliberately does not choose a model.
   */
  model: LanguageModel;
  timeoutMs?: number;
  nativeToolOptions?: NativeXSearchOptions;
}

const DEPTH_LIMITS = {
  quick: { min: 8, max: 12 },
  default: { min: 15, max: 25 },
  deep: { min: 40, max: 60 },
} as const;

export function createDelegatedXSearchTool(
  options: DelegatedXSearchOptions,
): Tool<XSearchInput, XSearchResult[]> {
  return tool({
    description:
      "Search current public posts on X using xAI's native X search.",
    inputSchema: xSearchInputSchema,
    execute: async (input, execution) => {
      const limits = DEPTH_LIMITS[input.depth];
      const prompt = [
        `Search X for posts about: ${input.query}`,
        input.from_date || input.to_date
          ? `Focus on posts from ${input.from_date ?? "the earliest available date"} through ${input.to_date ?? "now"}.`
          : null,
        `Find ${limits.min}-${limits.max} high-quality, relevant posts.`,
        "Prefer substantive posts with high engagement. Include diverse voices.",
        "Use YYYY-MM-DD for dates when known; use null when unknown.",
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
      const timeout = AbortSignal.timeout(
        options.timeoutMs ?? DEFAULT_X_SEARCH_TIMEOUT_MS,
      );
      const abortSignal = execution.abortSignal
        ? AbortSignal.any([execution.abortSignal, timeout])
        : timeout;
      const { output } = await generateText({
        abortSignal,
        model: options.model,
        output: Output.object({
          schema: xSearchOutputSchema,
          name: "x_search_results",
          description: "Relevant public X posts returned by native X search.",
        }),
        prompt,
        tools: {
          x_search: createNativeXSearchTool({
            ...options.nativeToolOptions,
            ...(input.from_date && { fromDate: input.from_date }),
            ...(input.to_date && { toDate: input.to_date }),
          }),
        } as Parameters<typeof generateText>[0]["tools"],
      });

      return output.items.slice(0, limits.max).map((item) => ({
        text: item.text.trim().slice(0, 500),
        url: item.url,
        author: (item.author_handle ?? "").replace(/^@/, ""),
        date: item.date,
        likes: item.engagement?.likes ?? null,
        reposts: item.engagement?.reposts ?? null,
      }));
    },
  });
}
