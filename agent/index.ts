import { config } from './config';
import { crawl } from './recon/crawl';
import { validate } from './validator';
import { formatReport } from './report';
import type { ValidationResult } from './validator/types';
import { mkdirSync, writeFileSync } from 'node:fs';

async function main() {
    console.log(`\n🔍 CodSec — scanning ${config.targetBaseUrl} for SQL injection\n`);

    // ── PHASE 1: recon ── deterministic crawl → candidate queue (no LLM)
    console.log('── Phase 1: crawl ──');
    const candidates = await crawl('/');
    console.log(`Found ${candidates.length} candidate injection point(s).\n`);

    // ── PHASE 2: drain ── validate each candidate with the oracles (no LLM)
    console.log('── Phase 2: validate ──');
    const findings: ValidationResult[] = [];
    for (const c of candidates) {
        process.stdout.write(`  #${c.id} ${c.method} ${c.path}#${c.field} … `);
        const result = await validate(c);
        findings.push(result);
        console.log(`${result.verdict} (${result.severity}, ${result.techniques.join(',') || '—'})`);

        // Deep-mode hook: anything the oracles couldn't settle goes to the LLM
        // later (confidence ladder). Deferred for now — just flag it.
        if (result.verdict === 'SUSPECTED') {
            console.log(`     ↳ SUSPECTED — LLM deep-mode deferred; left for human review.`);
        }
    }

    // ── PHASE 3: report ──
    console.log('\n── Phase 3: report ──\n');
    console.log(formatReport(findings));

    mkdirSync('runs', { recursive: true });
    const file = `runs/report-${Date.now()}.json`;
    writeFileSync(file, JSON.stringify(findings, null, 2));
    console.log(`\nSaved ${findings.length} result(s) → ${file}`);
}

main().catch((err) => { console.error(err); process.exit(1); });