// The safety boundary, enforced in code — NOT in the system prompt.
// A prompt is a suggestion an LLM can be talked out of; a thrown error is not.
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertAllowedUrl(rawUrl: string): URL {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error(`Refusing request: not a valid URL: ${rawUrl}`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Refusing request: unsupported protocol ${url.protocol}`);
    }

    const host = url.hostname.replace(/^\[|\]$/g, ''); // ipv6 hostname arrive bracketed
    if (!ALLOWED_HOSTS.has(host)) {
        throw new Error(
            `Refusing request to non-allow-listed host "${host}". ` +
            `CodSec only attacks local targets (${[...ALLOWED_HOSTS].join(', ')}).`,
        );
    }

    return url;
}

// Non-destructive guard — the second check at the egress chokepoint. Offensive PROOF
// never needs to mutate data, so no tool (present or future) may send DDL/DML or a
// stacked query (;). Enforced in code, not the prompt: the LLM can't be talked past it.
const DESTRUCTIVE = /\b(drop|delete|insert|update|alter|truncate|create|replace|grant|revoke|attach|detach|pragma|vacuum)\b|;/i;

export function assertNonDestructive(values: Iterable<string>): void {
    for (const v of values) {
        if (typeof v === 'string' && DESTRUCTIVE.test(v)) {
            throw new Error(
                `Refusing request: payload contains a destructive or stacked statement ` +
                `("${v.slice(0, 60)}"). CodSec proves injection with read-only payloads ` +
                `only (UNION / boolean / time-based).`,
            );
        }
    }
}