import { describe, expect, it, vi } from "vitest";
import {
  isPublicIpAddress,
  readSafeText,
  SafeFetchError,
  validatePublicUrl,
} from "./index.js";

describe("public URL validation", () => {
  it.each([
    "https://localhost/a",
    "https://service.internal/a",
    "https://127.0.0.1/a",
    "https://10.0.0.1/a",
    "https://169.254.169.254/a",
    "https://[::1]/a",
    "https://[fd00::1]/a",
    "ftp://example.com/a",
    "https://user:secret@example.com/a",
  ])("rejects %s", async (value) => {
    await expect(validatePublicUrl(value)).rejects.toBeInstanceOf(
      SafeFetchError,
    );
  });

  it("accepts a public HTTPS URL and strips fragments", async () => {
    await expect(
      validatePublicUrl("https://example.com/a#secret"),
    ).resolves.toMatchObject({ hash: "", hostname: "example.com" });
  });

  it("rejects hostnames resolving to any private address", async () => {
    await expect(
      validatePublicUrl("https://example.com", {
        resolver: async () => ["93.184.216.34", "10.0.0.1"],
      }),
    ).rejects.toMatchObject({ code: "PublicUrlDestinationRejected" });
  });

  it("classifies public and special-use addresses", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
  });
});

describe("safe text reads", () => {
  it("revalidates redirects before fetching their destination", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "https://127.0.0.1/private" },
        }),
    );
    await expect(
      readSafeText("https://example.com", { fetcher }),
    ).rejects.toMatchObject({ code: "PublicUrlDestinationRejected" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds streamed response bodies", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("too much", {
          headers: { "Content-Type": "text/plain" },
        }),
    );
    await expect(
      readSafeText("https://example.com", {
        fetcher,
        maxResponseBytes: 3,
      }),
    ).rejects.toMatchObject({ code: "PublicUrlResponseTooLarge" });
  });

  it("rejects non-text content and returns the final validated URL", async () => {
    const binary = vi.fn(
      async () =>
        new Response("x", {
          headers: { "Content-Type": "image/png" },
        }),
    );
    await expect(
      readSafeText("https://example.com", { fetcher: binary }),
    ).rejects.toMatchObject({ code: "PublicUrlContentTypeRejected" });

    const text = vi.fn(
      async () =>
        new Response("hello", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    );
    await expect(
      readSafeText("https://example.com/a", { fetcher: text }),
    ).resolves.toMatchObject({
      contentType: "text/html; charset=utf-8",
      text: "hello",
    });
  });
});
