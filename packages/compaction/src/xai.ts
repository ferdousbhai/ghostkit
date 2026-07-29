export const XAI_DEFAULT_COMPACTION_TIMEOUT_MS = 30_000;

export type XaiResponsesInputItem = Record<string, unknown>;

export type XaiNativeUsage = Readonly<{
  cacheReadInputTokens: number;
  costUsdTicks: number | null;
  inputTokens: number;
  outputTokens: number;
  serverSideToolCalls: number;
  totalTokens: number;
}>;

export type XaiCompactionUsage = XaiNativeUsage &
  Readonly<{
    droppedMessageCount: number;
  }>;

export type XaiCompactionResult = Readonly<{
  /** Replay this output array verbatim as the prefix of the next Responses input. */
  items: readonly XaiResponsesInputItem[];
  usage: XaiCompactionUsage;
}>;

export type XaiCompactionTransportRequest = Readonly<{
  body: Readonly<Record<string, unknown>>;
  conversationId?: string;
  path: "/responses/compact" | "/tokenize-text";
  signal: AbortSignal;
}>;

/**
 * Application-owned authenticated transport.
 *
 * The consumer chooses its xAI or gateway base URL and supplies credentials.
 * Ghostkit owns only provider request bodies and response validation.
 */
export type XaiCompactionTransport = (
  request: XaiCompactionTransportRequest,
) => Promise<Response>;

export type XaiCompactionAdapter = Readonly<{
  compactInput: (input: {
    conversationId?: string;
    items: readonly XaiResponsesInputItem[];
    model: string;
  }) => Promise<XaiCompactionResult>;
  countInputTokens: (input: {
    items: readonly XaiResponsesInputItem[];
    model: string;
  }) => Promise<number>;
  shouldCompactInput: (input: {
    hardLimitTokens: number;
    headroomTokens?: number;
    items: readonly XaiResponsesInputItem[];
    knownTokens?: number;
    model: string;
  }) => Promise<boolean>;
}>;

export function createXaiCompactionAdapter(options: {
  request: XaiCompactionTransport;
  timeoutMs?: number;
}): XaiCompactionAdapter {
  const timeoutMs = positiveSafeInteger(
    options.timeoutMs ?? XAI_DEFAULT_COMPACTION_TIMEOUT_MS,
    "timeoutMs",
  );

  const countInputTokens: XaiCompactionAdapter["countInputTokens"] = async (
    input,
  ) => {
    const model = requiredString(input.model, "model");
    const response = await requestWithTimeout(
      options.request,
      {
        body: {
          model,
          text: JSON.stringify(input.items),
        },
        path: "/tokenize-text",
      },
      timeoutMs,
      "xAI context token counting timed out",
    );
    await assertSuccessfulResponse(response, "xAI context token counting");
    const tokenIds = asRecord(await response.json())?.token_ids;
    if (!Array.isArray(tokenIds)) {
      throw new Error("xAI context token counting returned no token IDs");
    }
    return tokenIds.length;
  };

  const compactInput: XaiCompactionAdapter["compactInput"] = async (input) => {
    const model = requiredString(input.model, "model");
    if (input.items.length === 0) {
      throw new Error("Cannot compact an empty xAI context");
    }
    const response = await requestWithTimeout(
      options.request,
      {
        body: {
          model,
          input: input.items,
        },
        ...(input.conversationId && {
          conversationId: input.conversationId,
        }),
        path: "/responses/compact",
      },
      timeoutMs,
      "xAI context compaction timed out",
    );
    await assertSuccessfulResponse(response, "xAI context compaction");

    const payload = asRecord(await response.json());
    const items = asInputItems(payload?.output);
    if (!items || !readCompactionItem(items[0])) {
      throw new Error(
        "xAI context compaction returned no valid compaction item",
      );
    }
    const usage = parseXaiNativeUsage(payload?.usage) ?? emptyXaiUsage();
    return {
      items,
      usage: {
        ...usage,
        droppedMessageCount: asNonNegativeInteger(
          asRecord(payload?.usage)?.dropped_message_count,
        ),
      },
    };
  };

  const shouldCompactInput: XaiCompactionAdapter["shouldCompactInput"] = async (
    input,
  ) => {
    const hardLimitTokens = positiveSafeInteger(
      input.hardLimitTokens,
      "hardLimitTokens",
    );
    const knownTokens = asNonNegativeInteger(input.knownTokens);
    const headroomTokens = asNonNegativeInteger(input.headroomTokens);
    if (knownTokens + headroomTokens >= hardLimitTokens) return true;

    // One byte cannot require more than one byte-fallback token. Avoid a
    // provider request when even that conservative bound fits.
    if (
      knownTokens + serializedByteLength(input.items) + headroomTokens <
      hardLimitTokens
    ) {
      return false;
    }

    try {
      const itemTokens = await countInputTokens(input);
      return knownTokens + itemTokens + headroomTokens >= hardLimitTokens;
    } catch {
      // Failing closed avoids sending a context that may exceed the provider's
      // hard limit when precise preflight counting is unavailable.
      return true;
    }
  };

  return {
    compactInput,
    countInputTokens,
    shouldCompactInput,
  };
}

export function readXaiResponseInput(
  requestBody: unknown,
): XaiResponsesInputItem[] | null {
  return asInputItems(asRecord(requestBody)?.input);
}

export function readXaiCompletedResponseOutput(
  rawChunk: unknown,
): XaiResponsesInputItem[] | null {
  return asInputItems(readCompletedResponse(rawChunk)?.output);
}

export function buildXaiCompactionInput(
  step: Readonly<{
    input: readonly XaiResponsesInputItem[];
    output: readonly XaiResponsesInputItem[];
  }>,
): XaiResponsesInputItem[] {
  return [
    ...step.input.filter((item) => !isSystemInputItem(item)),
    ...step.output,
  ];
}

export function parseXaiNativeUsage(value: unknown): XaiNativeUsage | null {
  const usage = asRecord(value);
  if (!usage) return null;
  const inputTokens = asNonNegativeInteger(usage.input_tokens);
  const outputTokens = asNonNegativeInteger(usage.output_tokens);
  const reportedTotalTokens = asNonNegativeInteger(usage.total_tokens);
  return {
    cacheReadInputTokens: asNonNegativeInteger(
      asRecord(usage.input_tokens_details)?.cached_tokens,
    ),
    costUsdTicks: readNonNegativeIntegerOrNull(usage.cost_in_usd_ticks),
    inputTokens,
    outputTokens,
    serverSideToolCalls: asNonNegativeInteger(usage.num_server_side_tools_used),
    totalTokens: reportedTotalTokens || inputTokens + outputTokens,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asInputItems(value: unknown): XaiResponsesInputItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(asRecord);
  return items.every((item) => item !== null)
    ? (items as XaiResponsesInputItem[])
    : null;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function readNonNegativeIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function serializedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function readCompletedResponse(
  rawChunk: unknown,
): Record<string, unknown> | null {
  const event = parseRawEvent(rawChunk);
  if (
    event?.type !== "response.completed" &&
    event?.type !== "response.incomplete" &&
    event?.type !== "response.done"
  ) {
    return null;
  }
  return asRecord(event.response);
}

function parseRawEvent(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return asRecord(value);
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function isSystemInputItem(item: XaiResponsesInputItem): boolean {
  return item.role === "system" || item.role === "developer";
}

function readCompactionItem(value: unknown): XaiResponsesInputItem | null {
  const item = asRecord(value);
  return item?.type === "compaction" &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.encrypted_content === "string" &&
    item.encrypted_content.length > 0
    ? item
    : null;
}

function emptyXaiUsage(): XaiNativeUsage {
  return {
    cacheReadInputTokens: 0,
    costUsdTicks: null,
    inputTokens: 0,
    outputTokens: 0,
    serverSideToolCalls: 0,
    totalTokens: 0,
  };
}

async function requestWithTimeout(
  request: XaiCompactionTransport,
  input: Omit<XaiCompactionTransportRequest, "signal">,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(timeoutMessage)),
    timeoutMs,
  );
  try {
    return await request({ ...input, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function assertSuccessfulResponse(
  response: Response,
  operation: string,
): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text().catch(() => "")).slice(0, 1_000);
  throw new Error(
    `${operation} failed (${response.status})${detail ? `: ${detail}` : ""}`,
  );
}

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function requiredString(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}
