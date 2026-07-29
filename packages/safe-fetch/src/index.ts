import ipaddr from "ipaddr.js";

const FORBIDDEN_HOST_SUFFIXES = [
  ".home.arpa",
  ".internal",
  ".invalid",
  ".local",
  ".localhost",
  ".test",
];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_CONTENT_TYPES = ["text/", "application/json", "application/xml"];

export type DnsResolver = (hostname: string) => Promise<readonly string[]>;

export type SafeFetchOptions = Readonly<{
  fetcher?: typeof fetch;
  resolver?: DnsResolver;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  allowedContentTypes?: readonly string[];
  allowHttp?: boolean;
  headers?: HeadersInit;
}>;

export type SafeTextResponse = Readonly<{
  response: Response;
  finalUrl: URL;
  contentType: string;
  text: string;
}>;

export class SafeFetchError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "SafeFetchError";
  }
}

export function isPublicIpAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address.replace(/^\[|\]$/g, ""));
    const normalized =
      parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address()
        : parsed;
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

export async function validatePublicUrl(
  value: string | URL,
  options: Pick<SafeFetchOptions, "allowHttp" | "resolver"> = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new SafeFetchError("InvalidPublicUrl", { cause });
  }
  if (
    url.protocol !== "https:" &&
    !(options.allowHttp === true && url.protocol === "http:")
  ) {
    throw new SafeFetchError("PublicUrlProtocolRejected");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("PublicUrlCredentialsRejected");
  }
  url.hash = "";
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    FORBIDDEN_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SafeFetchError("PublicUrlDestinationRejected");
  }
  const literal = ipaddr.isValid(hostname);
  const addresses = literal
    ? [hostname]
    : options.resolver
      ? await options.resolver(hostname)
      : [];
  if (
    (literal || options.resolver) &&
    (!addresses.length ||
      addresses.some((address) => !isPublicIpAddress(address)))
  ) {
    throw new SafeFetchError("PublicUrlDestinationRejected");
  }
  return url;
}

export async function safeFetch(
  value: string | URL,
  options: SafeFetchOptions = {},
): Promise<{ response: Response; finalUrl: URL }> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let current = await validatePublicUrl(value, options);
  const maxRedirects = options.maxRedirects ?? 5;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetcher(current, {
      headers: options.headers,
      method: "GET",
      redirect: "manual",
      signal,
    });
    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: current };
    }
    const location = response.headers.get("Location");
    await response.body?.cancel().catch(() => {});
    if (!location || redirects === maxRedirects) {
      throw new SafeFetchError("PublicUrlRedirectRejected");
    }
    current = await validatePublicUrl(new URL(location, current), options);
  }
  throw new SafeFetchError("PublicUrlRedirectRejected");
}

export async function readSafeText(
  value: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeTextResponse> {
  const { response, finalUrl } = await safeFetch(value, options);
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new SafeFetchError(`PublicUrlFetch${response.status}`);
  }
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  const allowed = options.allowedContentTypes ?? DEFAULT_CONTENT_TYPES;
  if (!allowed.some((prefix) => contentType.includes(prefix))) {
    await response.body?.cancel().catch(() => {});
    throw new SafeFetchError("PublicUrlContentTypeRejected");
  }
  const text = await readBoundedText(
    response,
    options.maxResponseBytes ?? 2_000_000,
  );
  return { response, finalUrl, contentType, text };
}

export async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new SafeFetchError("InvalidPublicUrlResponseLimit");
  }
  const declared = response.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new SafeFetchError("PublicUrlResponseTooLarge");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new SafeFetchError("PublicUrlResponseTooLarge");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
