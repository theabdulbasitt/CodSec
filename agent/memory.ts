import type { DiscoveredForm } from './tools/discover';
import type { ValidationResult } from './validator/types';

export class Memory {
    engine: string | null = null;
    forms: DiscoveredForm[] = [];
    findings: ValidationResult[] = [];
    private tried = new Map<string, string>(); // request key -> outcome digest
    notes: string[] = [];

    private keyFor(name: string, args: unknown): string {
        return name + ':' + stableStringify(args);
    }
    alreadyTried(name: string, args: unknown): string | undefined {
        return this.tried.get(this.keyFor(name, args));
    }
    record(name: string, args: unknown, outcome: string): void {
        this.tried.set(this.keyFor(name, args), outcome);
    }

    // Accumulate discovered forms across discover() calls, deduped by canonical
    // signature (order-independent). Pure + testable — no network here.
    addForms(found: DiscoveredForm[]): void {
        for (const f of found) {
            const sig = stableStringify(f);
            if (!this.forms.some((e) => stableStringify(e) === sig)) {
                this.forms.push(f);
            }
        }
    }

    findingFor(path: string, method: string, field: string): ValidationResult | undefined {
        return this.findings.find(
            (f) => f.finding.path === path && f.finding.method === method && f.finding.field === field,
        );
    }
    addFinding(r: ValidationResult): void {
        this.findings.push(r);
    }

    triedList(): string {
        const rows = [...this.tried.entries()].map(([k, v]) => `  ${k}\n     -> ${v}`);
        return rows.length ? rows.join('\n') : '(none)';
    }
    summary(): string {
        return [
            `DB engine: ${this.engine ?? 'unknown'}`,
            this.forms.length ? `Forms mapped: ${JSON.stringify(this.forms)}` : 'Forms mapped: none yet',
            `Distinct requests tried: ${this.tried.size}`,
            this.findings.length
                ? `Findings so far: ${this.findings.map((f) => `${f.verdict} ${f.finding.method} ${f.finding.path}#${f.finding.field}`).join('; ')}`
                : '',
            this.notes.length ? `Notes: ${this.notes.join('; ')}` : '',
        ].filter(Boolean).join('\n');
    }
}

function stableStringify(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    const obj = v as Record<string, unknown>;
    return '{' + Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
        .join(',') + '}';
}