import { NextRequest } from "next/server";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface InvokeOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  url?: string;
}

export function buildRequest(opts: InvokeOptions = {}): NextRequest {
  const base = opts.url ?? "http://localhost:3000/api/test";
  const url = new URL(base);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    },
  };

  if (opts.body !== undefined && init.method !== "GET" && init.method !== "HEAD") {
    init.body =
      typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  return new NextRequest(url, init);
}

export async function readJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function invokeRoute<T = unknown>(
  handler: (req: NextRequest, ctx?: unknown) => Promise<Response> | Response,
  opts: InvokeOptions & { context?: unknown } = {}
): Promise<{ status: number; body: T; response: Response }> {
  const req = buildRequest(opts);
  const response = await handler(req, opts.context);
  const body = await readJson<T>(response);
  return { status: response.status, body, response };
}
