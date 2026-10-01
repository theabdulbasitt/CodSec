import { discover } from '../tools/discover';

export interface Candidate {
    id: number;                           // reference number (stable handle)
    source: string;                       // page where this candidate was discovered
    path: string;
    method: 'GET' | 'POST';
    field: string;
    otherFields: Record<string, string>;
}

const BENIGN = 'x';

// Deterministic BFS crawl: visit every internal page once, extract an injection
// candidate for each form field AND each query-string parameter. No LLM.
export async function crawl(startPath = '/'): Promise<Candidate[]> {
    const visited = new Set<string>();
    const toVisit: string[] = [startPath];
    const candidates: Candidate[] = [];
    const seen = new Set<string>(); // dedup: "METHOD path field"
    let nextId = 1;

    const add = (c: Omit<Candidate, 'id'>) => {
        const k = `${c.method} ${c.path} ${c.field}`;
        if (!seen.has(k)) { seen.add(k); candidates.push({ id: nextId++, ...c }); }
    };

    while (toVisit.length) {
        const path = toVisit.shift()!;
        const pageKey = path.split('?')[0];
        if (visited.has(pageKey)) continue;
        visited.add(pageKey);

        const d = await discover(path);

        // Forms → one candidate per input field (other inputs get benign values).
        for (const form of d.forms) {
            const action = form.action || path;
            const method = form.method === 'POST' ? 'POST' : 'GET';
            for (const field of form.inputs) {
                const otherFields: Record<string, string> = {};
                for (const f of form.inputs) if (f !== field) otherFields[f] = BENIGN;
                add({ source: path, path: action, method, field, otherFields });
            }
        }

        // Links: extract GET query params as candidates, and enqueue new pages.
        for (const link of d.links) {
            const [linkPath, qs] = link.split('?');
            if (qs) {
                const params = new URLSearchParams(qs);
                for (const [field] of params) {
                    const otherFields: Record<string, string> = {};
                    for (const [k, v] of params) if (k !== field) otherFields[k] = v;
                    add({ source: path, path: linkPath, method: 'GET', field, otherFields });
                }
            }
            if (linkPath.startsWith('/') && !visited.has(linkPath)) toVisit.push(linkPath);
        }
    }
    return candidates;
}