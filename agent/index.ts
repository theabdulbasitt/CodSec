import { config } from './config';
import { crawl, type Candidate } from './recon/crawl';
import { validate } from './validator';
import { deepMode } from './deepmode';
import { formatReport } from './report';
import type { ValidationResult } from './validator/types';
import { mkdirSync, writeFileSync } from 'node:fs';

async function main() {
    console.log(`\n🔍 CodSec — scanning ${config.targetBaseUrl} for SQL injection\n`);

    // ── PHASE 1: recon ──
    console.log('── Phase 1: crawl ──');
    const candidates = await crawl('/');
    console.log(`Found ${candidates.length} candidate injection point(s).\n`);

    // ── PHASE 2: deterministic drain ──
    console.log('── Phase 2: validate (deterministic) ──');
    const findings: ValidationResult[] = [];
    for (const c of candidates) {
        process.stdout.write(`  #${c.id} ${c.method} ${c.path}#${c.field} … `);
        const result = await validate(c);
        findings.push(result);
        console.log(`${result.verdict} (${result.severity}, ${result.techniques.join(',') || '—'})`);
    }

    // ── PHASE 2.5: deep-mode (LLM) on anything still SUSPECTED ──
    const suspectedCount = findings.filter((f) => f.verdict === 'SUSPECTED').length;
    if (suspectedCount) {
        console.log(`\n── Phase 2.5: deep-mode (LLM) on ${suspectedCount} SUSPECTED ──`);
        for (let i = 0; i < findings.length; i++) {
            if (findings[i].verdict !== 'SUSPECTED') continue;
            const c = findings[i].finding as Candidate;
            console.log(`  deep #${c.id} ${c.method} ${c.path}#${c.field} …`);
            findings[i] = await deepMode(c, findings[i]);
            console.log(`    → ${findings[i].verdict === 'PROVEN' ? 'PROVEN (deep)' : 'still SUSPECTED'}`);
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