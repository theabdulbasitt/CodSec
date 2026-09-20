import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digestHttp } from '../digest';
import type { HttpResult } from '../tools/http';

function makeResult(over: Partial<HttpResult>): HttpResult {
    return { url: 'http://localhost/x', status: 200, elapsedMs: 5, headers: {}, body: '', truncated: false, ...over };
}

test('keeps a short body verbatim', () => {
    const body = '<p>Welcome back, alice!</p>';
    const d = JSON.parse(digestHttp(makeResult({ body })));
    assert.equal(d.body, body);
    assert.equal(d.status, 200);
    assert.equal(d.len, body.length);
});

test('truncates a long body but keeps the signal line + byte count', () => {
    const noise = 'x'.repeat(500);
    const body = `${noise}\n<pre>DB error: unrecognized token</pre>\n${noise}`;
    const d = JSON.parse(digestHttp(makeResult({ body })));
    assert.match(d.body, /unrecognized token/);   // signal line preserved
    assert.match(d.body, /bytes\]$/);              // byte-count suffix
    assert.ok(d.body.length < body.length);        // actually shrank
});

test('includes the server header when present', () => {
    const d = JSON.parse(digestHttp(makeResult({ headers: { 'x-powered-by': 'Express' } })));
    assert.equal(d.server, 'Express');
});