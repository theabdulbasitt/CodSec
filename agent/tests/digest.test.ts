import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digestHttp } from '../digest';
import type { HttpResult } from '../tools/http';

function makeResult(over: Partial<HttpResult>): HttpResult {
    return { url: 'http://localhost/x', status: 200, elapsedMs: 5, headers: {}, body: '', truncated: false, ...over };
}

test('keeps a short body as visible text (tags stripped)', () => {
    const body = '<p>Welcome back, alice!</p>';
    const d = JSON.parse(digestHttp(makeResult({ body })));
    assert.equal(d.text, 'Welcome back, alice!');   // tags gone, signal kept
    assert.equal(d.status, 200);
    assert.equal(d.len, body.length);                // raw byte length reported
});

test('strips tags and scripts to surface the signal', () => {
    const body = '<nav>Home</nav><script>var x=1</script><pre>DB error: no such column: abc</pre>';
    const d = JSON.parse(digestHttp(makeResult({ body, status: 500 })));
    assert.match(d.text, /DB error: no such column: abc/);  // signal survives
    assert.ok(!d.text.includes('<'));                        // no tag noise
    assert.ok(!d.text.includes('var x=1'));                  // script dropped
});

test('truncates a long body and appends a byte-count suffix', () => {
    const body = '<p>' + 'A'.repeat(600) + '</p>';
    const d = JSON.parse(digestHttp(makeResult({ body })));
    assert.match(d.text, /\[\d+B\]$/);        // byte-count suffix
    assert.ok(d.text.length < body.length);   // actually shrank
    assert.equal(d.len, body.length);         // raw length still reported
});

test('includes the server header when present', () => {
    const d = JSON.parse(digestHttp(makeResult({ headers: { 'x-powered-by': 'Express' } })));
    assert.equal(d.server, 'Express');
});