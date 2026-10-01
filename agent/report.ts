import type { ValidationResult } from './validator/types';

export function formatReport(findings: ValidationResult[]): string {
    if (!findings.length) return 'No findings were reported by the hunter.';

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
            if (e.oracle === 'computational') out.push(`     request: ${f.finding.field} = ${e.request}`);
        }
        if (f.reason) out.push(`  reason: ${f.reason}`);
        out.push('');
    }

    if (rejected.length) {
        out.push('Rejected (hunter claimed, validator disproved):');
        for (const f of rejected) {
            out.push(`  ✗ ${f.finding.method} ${f.finding.path} (field: ${f.finding.field})`);
        }
    }
    return out.join('\n');
}