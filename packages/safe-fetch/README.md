# `@summonghost/safe-fetch`

Bounded, SSRF-resistant public URL fetching designed for Cloudflare Workers and
other standards-based runtimes.

```ts
import { readSafeText } from "@summonghost/safe-fetch";

const page = await readSafeText("https://example.com/article", {
  maxRedirects: 3,
  maxResponseBytes: 500_000,
  resolver: resolvePublicAddresses,
});
```

It validates protocols and destinations, revalidates redirects, constrains
content types, and streams response bodies under a byte limit. Supply a DNS
resolver when the runtime exposes one to reject hostnames resolving to private
addresses before fetching.

See [Ghostkit](https://github.com/ferdousbhai/ghostkit) for source and design
notes.
