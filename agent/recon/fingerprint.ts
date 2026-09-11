// Fingerprint the DB engine from an error message's DIALECT, not its name.
// Our SQLite target leaks "unrecognized token" and never says "SQLite".
export type DbEngine = 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'unknown';

interface Signature { engine: DbEngine; pattern: RegExp; }

const SIGNATURES: Signature[] = [
    { engine: 'sqlite', pattern: /unrecognized token/i },
    { engine: 'sqlite', pattern: /SQLITE_ERROR/i },
    { engine: 'sqlite', pattern: /no such (column|table)/i },
    { engine: 'sqlite', pattern: /near ".*?": syntax error/i },
    { engine: 'postgres', pattern: /syntax error at or near/i },
    { engine: 'postgres', pattern: /unterminated quoted string/i },
    { engine: 'postgres', pattern: /PostgreSQL/i },
    { engine: 'mysql', pattern: /You have an error in your SQL syntax/i },
    { engine: 'mysql', pattern: /\b(MySQL|MariaDB)\b/i },
    { engine: 'mssql', pattern: /Unclosed quotation mark/i },
    { engine: 'mssql', pattern: /(SQL Server|Microsoft OLE DB)/i },
    { engine: 'oracle', pattern: /ORA-\d{5}/i },
];

export interface Fingerprint {
    engine: DbEngine;
    evidence: string | null;
}

export function fingerprintDb(text: string): Fingerprint {
    for (const sig of SIGNATURES) {
        const match = text.match(sig.pattern);
        if (match) return { engine: sig.engine, evidence: match[0] };
    }
    return { engine: 'unknown', evidence: null };
}