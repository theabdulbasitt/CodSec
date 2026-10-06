import type { ValidationResult } from './validator/types';

export function formatReport(findings: ValidationResult[]): string {
    if (!findings.length) return 'No findings.';

    const proven = findings.filter((f) => f.verdict === 'PROVEN');
    const suspected = findings.filter((f) => f.verdict === 'SUSPECTED');
    const rejected = findings.filter((f) => f.verdict === 'REJECTED');

    const out: string[] = [];
    out.push(`${proven.length} PROVEN · ${suspected.length} SUSPECTED · ${rejected.length} REJECTED (false positives)\n`);

    for (const f of [...proven, ...suspected]) {
        out.push(`[${f.verdict}] ${f.severity.toUpperCase()} — ${f.finding.method} ${f.finding.path}  (field: ${f.finding.field})`);
        out.push(`  techniques: ${f.techniques.join(', ') || 'none'}`);
        for (const e of f.evidence.filter((e) => e.passed)) {
            out.push(`  ✓ ${e.oracle}: ${e.actualSnippet}`);
            if (e.oracle.startsWith('computational')) out.push(`     request: ${f.finding.field} = ${e.request}`);
        }
        if (f.note) out.push(`  → ${f.note}`);
        if (f.hunter) {
            out.push(`  why:  ${f.hunter.why || '—'}`);
            if (f.hunter.how.length) {
                out.push(`  how:`);
                for (const step of f.hunter.how) out.push(`     - ${step}`);
            }
        }
        out.push('');
    }
    if (rejected.length) {
        out.push('Rejected (no injection effect reproduced):');
        for (const f of rejected) out.push(`  ✗ ${f.finding.method} ${f.finding.path} (field: ${f.finding.field})`);
    }
    return out.join('\n');
}