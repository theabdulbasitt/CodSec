import { config } from '../config';
import { assertAllowedUrl } from '../safety';

export interface HttpRequestArgs {
    method?: 'GET' | 'POST';
    path: string;                       // e.g. "/login"
    query?: Record<string, string>;     // querystring params
    form?: Record<string, string>;      // urlencoded body (for POST)
    headers?: Record<string, string>;
}

export interface HttpResult {
    url: string;
    status: number;
    elapsedMs: number;                  // matters for time-based blind SQLi later
    headers: Record<string, string>;
    body: string;
    truncated: boolean;
}

const MAX_BODY = 20_000;

export async function httpRequest(args: HttpRequestArgs): Promise<HttpResult> {
    const method = args.method ?? 'GET';
    const base = config.targetBaseUrl.replace(/\/$/, '');
    const path = args.path.startsWith('/') ? args.path : '/' + args.path;
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(args.query ?? {})) {
        url.searchParams.set(k, v);
    }

    assertAllowedUrl(url.href);         // ← the wall, before anything is sent

    const headers: Record<string, string> = { ...args.headers };
    const init: RequestInit = { method, headers };
    if (args.form) {
        init.body = new URLSearchParams(args.form).toString();
        headers['content-type'] = 'application/x-www-form-urlencoded';
    }

    const start = Date.now();
    const res = await fetch(url.href, init);
    const full = await res.text();
    const elapsedMs = Date.now() - start;

    const outHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { outHeaders[k] = v; });

    return {
        url: url.href,
        status: res.status,
        elapsedMs,
        headers: outHeaders,
        body: full.length > MAX_BODY ? full.slice(0, MAX_BODY) : full,
        truncated: full.length > MAX_BODY,
    };
}