import type { HttpResult } from './tools/http';

function pickBody(body: string): string {
    if (body.length <= 200) return body;
    // keep the line that carries the signal (error / reflection / flag), else head.
    const line = body.split('\n').find((l) => /error|welcome|CODSEC|sql|token|syntax/i.test(l));
    return (line ? line.trim().slice(0, 200) : body.slice(0, 200)) + ` … [${body.length} bytes]`;
}

export function digestHttp(r: HttpResult): string {
    const server = r.headers['x-powered-by'];
    return JSON.stringify({
        status: r.status,
        ms: r.elapsedMs,
        len: r.body.length,
        ...(server ? { server } : {}),
        body: pickBody(r.body),
    });
}