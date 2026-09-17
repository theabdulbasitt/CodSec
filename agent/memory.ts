function stableStringify(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    const obj = v as Record<string, unknown>;
    return '{' + Object.keys(obj).sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
        .join(',') + '}';
}

export class Memory {
    engine: string | null = null;
    forms: unknown[] = [];
    private tried = new Map<string, string>(); // request key -> outcome digest
    notes: string[] = [];

    private keyFor(name: string, args: unknown): string {
        return name + ':' + stableStringify(args);   // order-independent
    }

    alreadyTried(name: string, args: unknown): string | undefined {
        return this.tried.get(this.keyFor(name, args));
    }
    record(name: string, args: unknown, outcome: string): void {
        this.tried.set(this.keyFor(name, args), outcome);
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
            this.notes.length ? `Notes: ${this.notes.join('; ')}` : '',
        ].filter(Boolean).join('\n');
    }
}