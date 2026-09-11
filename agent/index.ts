import { httpRequest } from './tools/http';
import { discover } from './tools/discover';
import { fingerprintDb } from './recon/fingerprint';

async function main() {
    // MAP — learn endpoints/params from the landing page, black-box.
    const map = await discover('/');
    console.log('discovered forms:', JSON.stringify(map.forms, null, 2));
    console.log('links:', map.links);

    // FINGERPRINT — trigger an error, classify the engine from its dialect.
    const probe = await httpRequest({
        method: 'POST', path: '/login',
        form: { username: "'", password: 'x' }
    });
    const fp = fingerprintDb(probe.body);
    console.log(`\nprobe: ${probe.status} ${probe.body}`);
    console.log(`fingerprint: engine=${fp.engine}  evidence=${JSON.stringify(fp.evidence)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });