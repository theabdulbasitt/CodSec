import { validate } from './validator';

async function main() {
    const real = await validate({
        path: '/login', method: 'POST', field: 'username',
        otherFields: { password: 'x' }, technique: 'union', engine: 'sqlite',
    });
    print('REAL finding — /login username', real);

    // Bogus: /health has no injectable param. The validator should reject it.
    const fake = await validate({ path: '/health', method: 'GET', field: 'q' });
    print('FAKE finding — /health?q', fake);
}

function print(title: string, r: any) {
    console.log(`\n=== ${title} ===`);
    console.log('verdict   :', r.verdict, '| severity:', r.severity, '| techniques:', r.techniques);
    console.log('llm       :', r.llm, '| agreement:', r.agreement);
    console.log('note      :', r.note);
    for (const e of r.evidence) console.log(`  - ${e.oracle.padEnd(13)} passed=${e.passed}  ${e.actualSnippet}`);
}

main().catch((e) => { console.error(e); process.exit(1); });