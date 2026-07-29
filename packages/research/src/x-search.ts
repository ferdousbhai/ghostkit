import { xSearch, type XaiProvider } from "@ai-sdk/xai";
import {
  generateText,
  Output,
  tool,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type Tool,
  type ToolSet,
} from "ai";
import { z } from "zod";

export const X_SEARCH_MAX_RESULTS = 60;
export const X_SEARCH_MAX_TEXT_CHARACTERS = 25_000;
export const GROK_HANDOFF_TOOL_NAME = "handoff_to_grok" as const;
export const GROK_X_SEARCH_HANDOFF_RESULT_KIND =
  "grok_x_search_handoff" as const;

export const xSearchInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(2_000),
  from_date: z.iso.date().optional(),
  to_date: z.iso.date().optional(),
  depth: z.enum(["quick", "default", "deep"]).default("default"),
});

const xSearchEngagementSchema = z
  .strictObject({
    likes: z.number().int().nonnegative().nullable(),
    reposts: z.number().int().nonnegative().nullable(),
  })
  .nullable();

export const xSearchOutputSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        text: z
          .string()
          .trim()
          .min(1)
          .max(X_SEARCH_MAX_TEXT_CHARACTERS)
          .describe(
            `Post text returned by the provider, bounded to ${X_SEARCH_MAX_TEXT_CHARACTERS} characters.`,
          ),
        url: z
          .url()
          .max(4_096)
          .refine(
            (value) =>
              URL.canParse(value) && new URL(value).protocol === "https:",
            {
              message: "X post URL must use HTTPS",
            },
          )
          .describe("Direct HTTPS URL to the X post."),
        author_handle: z
          .string()
          .trim()
          .regex(/^@?[A-Za-z0-9_]{1,15}$/)
          .transform((value) => value.replace(/^@/, ""))
          .nullable()
          .describe("Author handle without @ when known."),
        date: z.iso
          .date()
          .nullable()
          .describe("Post date as YYYY-MM-DD when known."),
        engagement: xSearchEngagementSchema,
      }),
    )
    .max(X_SEARCH_MAX_RESULTS),
});

export type XSearchItem = z.infer<typeof xSearchOutputSchema>["items"][number];
export type XSearchInput = z.infer<typeof xSearchInputSchema>;

export type XSearchResult = Readonly<{
  text: string;
  url: string;
  author: string;
  date: string | null;
  likes: number | null;
  reposts: number | null;
}>;

const xHandleSchema = z
  .string()
  .trim()
  .regex(/^@?[A-Za-z0-9_]{1,15}$/)
  .transform((value) => value.replace(/^@/, ""));

export const grokXSearchHandoffInputSchema = z
  .strictObject({
    instructions: z
      .string()
      .trim()
      .min(1)
      .max(8_000)
      .describe(
        "Complete instructions for Grok: what to investigate on X, what evidence matters, and how to answer the user's original request.",
      ),
    from_date: z.iso.date().optional(),
    to_date: z.iso.date().optional(),
    allowed_x_handles: z
      .array(xHandleSchema)
      .min(1)
      .max(10)
      .optional()
      .describe("Only search these X handles."),
    excluded_x_handles: z
      .array(xHandleSchema)
      .min(1)
      .max(10)
      .optional()
      .describe("Exclude these X handles."),
    enable_image_understanding: z
      .boolean()
      .default(false)
      .describe("Allow Grok to analyze images found in X posts."),
    enable_video_understanding: z
      .boolean()
      .default(false)
      .describe("Allow Grok to analyze videos found in X posts."),
  })
  .superRefine((value, context) => {
    if (value.from_date && value.to_date && value.from_date > value.to_date) {
      context.addIssue({
        code: "custom",
        message: "from_date must not be after to_date",
        path: ["from_date"],
      });
    }
    if (value.allowed_x_handles && value.excluded_x_handles) {
      context.addIssue({
        code: "custom",
        message:
          "allowed_x_handles and excluded_x_handles are mutually exclusive",
        path: ["allowed_x_handles"],
      });
    }
  });

export type GrokXSearchHandoffInput = z.infer<
  typeof grokXSearchHandoffInputSchema
>;
export type NativeXSearchToolOptions = Parameters<
  XaiProvider["tools"]["xSearch"]
>[0];
export type NativeXSearchOptions = NativeXSearchToolOptions;

export function createNativeXSearchTool(
  options: NativeXSearchOptions = {},
): ReturnType<typeof xSearch> {
  return xSearch(options);
}

export interface DelegatedXSearchOptions {
  model: LanguageModel;
  timeoutMs?: number;
  nativeToolOptions?: NativeXSearchOptions;
}

const DEPTH_LIMITS = {
  quick: { min: 8, max: 12 },
  default: { min: 15, max: 25 },
  deep: { min: 40, max: 60 },
} as const;

/**
 * Backward-compatible delegated X-search tool. New orchestration can use
 * `runNativeXSearch` or `createHandoffToGrokTool` directly.
 */
export function createDelegatedXSearchTool(
  options: DelegatedXSearchOptions,
): Tool<XSearchInput, XSearchResult[]> {
  return tool({
    description:
      "Search current public posts on X using xAI's native X search.",
    inputSchema: xSearchInputSchema,
    execute: async (input, execution): Promise<XSearchResult[]> => {
      const limits = DEPTH_LIMITS[input.depth];
      const run = await runNativeXSearch({
        abortSignal: execution.abortSignal,
        maxItems: limits.max,
        model: options.model,
        nativeToolOptions: {
          ...options.nativeToolOptions,
          ...(input.from_date && { fromDate: input.from_date }),
          ...(input.to_date && { toDate: input.to_date }),
        },
        prompt: [
          `Search X for posts about: ${input.query}`,
          input.from_date || input.to_date
            ? `Focus on posts from ${input.from_date ?? "the earliest available date"} through ${input.to_date ?? "now"}.`
            : null,
          `Find ${limits.min}-${limits.max} high-quality, relevant posts.`,
          "Prefer substantive posts with high engagement. Include diverse voices.",
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n\n"),
        ...(options.timeoutMs !== undefined && {
          timeoutMs: options.timeoutMs,
        }),
      });
      return run.items.map((item) => ({
        text: item.text.trim().slice(0, 500),
        url: item.url,
        author: item.author_handle ?? "",
        date: item.date,
        likes: item.engagement?.likes ?? null,
        reposts: item.engagement?.reposts ?? null,
      }));
    },
  });
}

export interface RunNativeXSearchOptions {
  abortSignal?: AbortSignal;
  maxItems?: number;
  maxOutputTokens?: number;
  model: LanguageModel;
  nativeToolOptions?: NativeXSearchToolOptions;
  outputDescription?: string;
  outputName?: string;
  prompt: string;
  timeoutMs?: number;
}

export type NativeXSearchRun = Readonly<{
  items: readonly XSearchItem[];
  totalUsage: LanguageModelUsage;
}>;

export interface RunNativeXSearchAnswerOptions {
  abortSignal?: AbortSignal;
  maxOutputTokens?: number;
  messages: ModelMessage[];
  model: LanguageModel;
  nativeToolOptions?: NativeXSearchToolOptions;
  system: string;
  timeoutMs?: number;
}

export type NativeXSearchAnswer = Readonly<{
  text: string;
  totalUsage: LanguageModelUsage;
}>;

export type GrokXSearchHandoffResult = Readonly<{
  kind: typeof GROK_X_SEARCH_HANDOFF_RESULT_KIND;
  text: string;
  totalUsage: LanguageModelUsage;
}>;

export interface CreateHandoffToGrokToolOptions {
  maxOutputTokens?: number;
  model: LanguageModel;
  system?: string;
  timeoutMs?: number;
  toolDescription?: string;
}

/**
 * Run xAI's native X tool and normalize the result into a bounded structure.
 * The consumer supplies its configured Grok model, retaining ownership of
 * credentials, gateway routing, billing, and application prompts.
 */
export async function runNativeXSearch(
  options: RunNativeXSearchOptions,
): Promise<NativeXSearchRun> {
  const maximumItems = Math.min(
    Math.max(1, options.maxItems ?? X_SEARCH_MAX_RESULTS),
    X_SEARCH_MAX_RESULTS,
  );
  const abortSignal = withTimeout(options.abortSignal, options.timeoutMs);
  const result = await generateText({
    abortSignal,
    ...(options.maxOutputTokens !== undefined && {
      maxOutputTokens: options.maxOutputTokens,
    }),
    model: options.model,
    output: Output.object({
      schema: xSearchOutputSchema,
      name: options.outputName ?? "x_search_results",
      description:
        options.outputDescription ??
        "Relevant public X posts returned by xAI's native X search.",
    }),
    prompt: options.prompt,
    providerOptions: {
      xai: {
        store: false,
      },
    },
    toolChoice: "required",
    tools: {
      x_search: xSearch(options.nativeToolOptions) as ToolSet[string],
    },
  });

  return {
    items: result.output.items.slice(0, maximumItems),
    totalUsage: result.totalUsage,
  };
}

/**
 * Give Grok the complete turn so native X research and final synthesis happen
 * in one model call. A parent model can deliver the returned text directly.
 */
export async function runNativeXSearchAnswer(
  options: RunNativeXSearchAnswerOptions,
): Promise<NativeXSearchAnswer> {
  const abortSignal = withTimeout(options.abortSignal, options.timeoutMs);
  const result = await generateText({
    abortSignal,
    ...(options.maxOutputTokens !== undefined && {
      maxOutputTokens: options.maxOutputTokens,
    }),
    messages: options.messages,
    model: options.model,
    providerOptions: {
      xai: {
        store: false,
      },
    },
    system: options.system,
    toolChoice: "required",
    tools: {
      x_search: xSearch(options.nativeToolOptions) as ToolSet[string],
    },
  });
  const text = result.text.trim();
  if (!text) {
    throw new Error("Grok native X-search handoff returned an empty answer");
  }
  return {
    text,
    totalUsage: result.totalUsage,
  };
}

/**
 * Create the model-facing `handoff_to_grok` tool. When selected by a parent
 * model, Grok receives the conversation, performs native X research, and
 * returns the final answer without requiring another parent-model synthesis.
 */
export function createHandoffToGrokTool(
  options: CreateHandoffToGrokToolOptions,
): ToolSet[string] {
  return tool({
    description:
      options.toolDescription ??
      "Hand the rest of this turn to Grok for native X research and the final answer. Grok receives the conversation plus your explicit instructions; the current model will not synthesize afterward.",
    inputSchema: grokXSearchHandoffInputSchema,
    execute: async (input, execution): Promise<GrokXSearchHandoffResult> => {
      const result = await runNativeXSearchAnswer({
        abortSignal: execution.abortSignal,
        ...(options.maxOutputTokens !== undefined && {
          maxOutputTokens: options.maxOutputTokens,
        }),
        messages: execution.messages,
        model: options.model,
        nativeToolOptions: toNativeXSearchOptions(input),
        system: [
          options.system,
          "This turn was handed to you because the primary model selected X research.",
          `Handoff instructions from the primary model:\n${input.instructions}`,
          "Use the native x_search tool before answering. Answer the user's original request directly and cite direct X URLs.",
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n\n"),
        ...(options.timeoutMs !== undefined && {
          timeoutMs: options.timeoutMs,
        }),
      });

      return {
        kind: GROK_X_SEARCH_HANDOFF_RESULT_KIND,
        text: result.text,
        totalUsage: result.totalUsage,
      };
    },
  });
}

export function extractGrokHandoffText(
  steps: readonly {
    toolResults?: readonly {
      output?: unknown;
      toolName?: string;
    }[];
  }[],
): string | null {
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const results = steps[stepIndex]?.toolResults ?? [];
    for (
      let resultIndex = results.length - 1;
      resultIndex >= 0;
      resultIndex -= 1
    ) {
      const result = results[resultIndex];
      if (
        result?.toolName !== GROK_HANDOFF_TOOL_NAME ||
        !result.output ||
        typeof result.output !== "object"
      ) {
        continue;
      }
      const output = result.output as { kind?: unknown; text?: unknown };
      if (
        output.kind === GROK_X_SEARCH_HANDOFF_RESULT_KIND &&
        typeof output.text === "string" &&
        output.text.trim()
      ) {
        return output.text.trim();
      }
    }
  }
  return null;
}

const DIRECT_X_ROUTE_PATTERNS = [
  /\b(?:use|call|run)\s+(?:the\s+)?x_search\b/i,
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i,
  /\b(?:search|find|scan|research|check|look\s*up|summarize|review|analyze|show)\b.{0,60}\b(?:x|twitter|tweets?|(?:x|twitter)\s+(?:posts?|threads?)|(?:posts?|threads?)\s+(?:on|from)\s+(?:x|twitter))\b/i,
  /\b(?:latest|recent|current|top|popular|trending)\b.{0,30}\b(?:tweets?|(?:x|twitter)\s+(?:posts?|threads?)|(?:posts?|threads?)\s+(?:on|from)\s+(?:x|twitter))\b/i,
  /\b(?:what(?:'s| is| are)?|how)\b.{0,40}\b(?:x|twitter)\b.{0,40}\b(?:say|saying|think|react|discuss|sentiment)\b/i,
] as const;

/**
 * Precision-biased routing for prompts that explicitly request X research.
 * Ambiguous prompts remain with the primary model, which can still select the
 * `handoff_to_grok` tool while reasoning.
 */
export function shouldRouteDirectlyToGrokXSearch(
  messages: readonly ModelMessage[],
): boolean {
  const latestUserText = extractLatestUserText(messages).trim();
  return (
    latestUserText.length > 0 &&
    DIRECT_X_ROUTE_PATTERNS.some((pattern) => pattern.test(latestUserText))
  );
}

function toNativeXSearchOptions(
  input: GrokXSearchHandoffInput,
): NativeXSearchToolOptions {
  return {
    ...(input.allowed_x_handles && {
      allowedXHandles: input.allowed_x_handles.map((handle) =>
        handle.replace(/^@/, ""),
      ),
    }),
    ...(input.excluded_x_handles && {
      excludedXHandles: input.excluded_x_handles.map((handle) =>
        handle.replace(/^@/, ""),
      ),
    }),
    ...(input.from_date && { fromDate: input.from_date }),
    ...(input.to_date && { toDate: input.to_date }),
    ...(input.enable_image_understanding && {
      enableImageUnderstanding: true,
    }),
    ...(input.enable_video_understanding && {
      enableVideoUnderstanding: true,
    }),
  };
}

function withTimeout(
  parent: AbortSignal | undefined,
  timeoutMs = 120_000,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function extractLatestUserText(messages: readonly ModelMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as unknown as {
      content?: unknown;
      parts?: unknown;
      role?: string;
    };
    if (message.role !== "user") continue;
    const text = extractText(message.content) || extractText(message.parts);
    if (text.trim()) return text;
  }
  return "";
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n\n");
  }
  if (!value || typeof value !== "object") return "";
  const part = value as {
    content?: unknown;
    text?: unknown;
    type?: unknown;
  };
  if (part.type === "text" && typeof part.text === "string") return part.text;
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}
