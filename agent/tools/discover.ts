import { httpRequest } from './http';

export interface DiscoveredForm {
    action: string;
    method: string;
    inputs: string[];
}

export interface Discovery {
    path: string;
    status: number;
    forms: DiscoveredForm[];
    links: string[];
}

// Pure HTML parser — no network, so it can be unit-tested with fixtures.
export function parsePage(html: string, path: string): { forms: DiscoveredForm[]; links: string[] } {
    const forms: DiscoveredForm[] = [];
    const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let m: RegExpExecArray | null;
    while ((m = formRe.exec(html))) {
        const attrs = m[1];
        const inner = m[2];
        const action = attrs.match(/action\s*=\s*["']([^"']*)["']/i)?.[1] ?? path;
        const method = (attrs.match(/method\s*=\s*["']([^"']*)["']/i)?.[1] ?? 'GET').toUpperCase();
        const inputs: string[] = [];
        const inputRe = /<(?:input|textarea|select)\b[^>]*\bname\s*=\s*["']([^"']+)["']/gi;
        let im: RegExpExecArray | null;
        while ((im = inputRe.exec(inner))) inputs.push(im[1]);
        forms.push({ action, method, inputs });
    }

    const links: string[] = [];
    const linkRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html))) links.push(lm[1]);

    return { forms, links: [...new Set(links)] };
}

export async function discover(path: string): Promise<Discovery> {
    const res = await httpRequest({ path });
    const { forms, links } = parsePage(res.body, path);
    return { path, status: res.status, forms, links };
}