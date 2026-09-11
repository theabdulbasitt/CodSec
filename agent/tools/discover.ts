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

// Minimal HTML scraping via regex — fine for our controlled targets. A real
// crawler would use a parser (cheerio); we keep deps at zero on purpose.
export async function discover(path: string): Promise<Discovery> {
    const res = await httpRequest({ path });
    const html = res.body;

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

    return { path, status: res.status, forms, links: [...new Set(links)] };
}