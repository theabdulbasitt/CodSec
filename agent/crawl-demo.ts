import { crawl } from './recon/crawl';

async function main() {
    const candidates = await crawl('/');
    console.log(`Discovered ${candidates.length} candidate injection points:\n`);
    for (const c of candidates) {
        console.log(
            `  #${String(c.id).padEnd(2)} ${c.method.padEnd(4)} ${c.path.padEnd(12)} ` +
            `field=${c.field.padEnd(10)} (found on ${c.source})  other=${JSON.stringify(c.otherFields)}`,
        );
    }
}
main().catch((e) => { console.error(e); process.exit(1); });