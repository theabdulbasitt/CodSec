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