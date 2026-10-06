import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowedUrl, assertNonDestructive } from '../safety';

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

test('non-destructive guard: blocks DDL/DML keywords', () => {
    for (const payload of [
        '1 OR 1=1; DROP TABLE accounts; --',   // stacked + DROP
        "'; DELETE FROM users --",             // stacked + DELETE
        '1 UNION SELECT * FROM x; --',          // stacked query (the ; alone)
        "' OR 1=1; UPDATE users SET admin=1 --",
        '0; pragma table_info(users)',          // sqlite PRAGMA
    ]) {
        assert.throws(() => assertNonDestructive([payload]), /destructive or stacked/, `should block: ${payload}`);
    }
});

test('non-destructive guard: blocks a destructive value among benign ones', () => {
    // the guard scans EVERY value, not just the first
    assert.throws(
        () => assertNonDestructive(['x', 'alice', 'DROP TABLE t']),
        /destructive or stacked/,
    );
});

test('non-destructive guard: allows read-only proof payloads', () => {
    for (const payload of [
        "' UNION SELECT 'ABC'||(195*497),'ABC'||(195*497)-- ",  // computational oracle
        '0 UNION SELECT 1,2-- ',                                 // numeric-context UNION
        "' OR 1=1-- ",                                           // boolean TRUE
        "' AND 1=2-- ",                                          // boolean FALSE
        "' ORDER BY 3-- ",                                       // column-count probe
        "'",                                                     // bare-quote error probe
        'abc', '2', '-1', 'all',                                  // recon values
    ]) {
        assert.doesNotThrow(() => assertNonDestructive([payload]), `should allow: ${payload}`);
    }
});

test('non-destructive guard: passes on empty input', () => {
    assert.doesNotThrow(() => assertNonDestructive([]));
});