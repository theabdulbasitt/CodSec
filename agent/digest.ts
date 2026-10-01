import type { HttpResult } from './tools/http';

// Strip HTML to visible text: drop scripts/styles/tags, decode a few entities,
// collapse whitespace. This surfaces the SIGNAL (reflected input, results, DB
// errors) instead of the boilerplate <head>/<nav>, and drops tag noise.
function visibleText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

export function digestHttp(r: HttpResult): string {
    const text = visibleText(r.body);
    const MAX = 240;
    const shown = text.length > MAX ? text.slice(0, MAX) + ` … [${r.body.length}B]` : text;
    const server = r.headers['x-powered-by'];
    return JSON.stringify({
        status: r.status,
        ms: r.elapsedMs,
        len: r.body.length,      // keep raw length — it's a boolean-diff signal
        ...(server ? { server } : {}),
        text: shown,
    });
}