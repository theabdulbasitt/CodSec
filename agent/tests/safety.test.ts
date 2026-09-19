import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowedUrl } from '../safety';

test('allows local hosts', () => {
    for (const u of ['http://localhost:8001/login', 'http://127.0.0.1:8001/', 'http://[::1]:8001/x']) {
        assert.doesNotThrow(() => assertAllowedUrl(u));
    }
});

test('rejects non-local hosts (incl. cloud metadata + prefix tricks)', () => {
    for (const u of [
        'http://example.com/',
        'https://evil.internal/x',
        'http://169.254.169.254/latest/meta-data',  // SSRF metadata endpoint
        'http://localhost.evil.com/',                // must NOT match by prefix
    ]) {
        assert.throws(() => assertAllowedUrl(u), /non-allow-listed host/);
    }
});

test('rejects non-http protocols', () => {
    assert.throws(() => assertAllowedUrl('file:///etc/passwd'), /unsupported protocol/);
    assert.throws(() => assertAllowedUrl('ftp://localhost/x'), /unsupported protocol/);
});

test('rejects malformed urls', () => {
    assert.throws(() => assertAllowedUrl('not a url'));
});