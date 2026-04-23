/**
 * Pluggable fetch mock. Register route handlers by URL substring or RegExp;
 * first matching handler wins. Falls through to rejecting unknown requests.
 */

type Matcher = string | RegExp;
type Handler = (
  url: string,
  init: RequestInit | undefined
) => Promise<Response> | Response;

const handlers: Array<{ matcher: Matcher; handler: Handler }> = [];
const originalFetch = globalThis.fetch;

export function registerFetchMock(matcher: Matcher, handler: Handler) {
  handlers.unshift({ matcher, handler });
}

export function resetFetchMock() {
  handlers.length = 0;
}

export function installFetchMock() {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    for (const { matcher, handler } of handlers) {
      const hit =
        typeof matcher === "string" ? url.includes(matcher) : matcher.test(url);
      if (hit) {
        const res = await handler(url, init);
        return res;
      }
    }
    throw new Error(`[mock-fetch] No handler matched: ${url}`);
  }) as typeof fetch;
}

export function uninstallFetchMock() {
  globalThis.fetch = originalFetch;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}
