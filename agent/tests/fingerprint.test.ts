import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintDb } from '../recon/fingerprint';

test('identifies SQLite by dialect, not by name', () => {
    const fp = fingerprintDb(`<pre>DB error: unrecognized token: "x'"</pre>`);
    assert.equal(fp.engine, 'sqlite');
    assert.match(fp.evidence ?? '', /unrecognized token/);
});

test('identifies each engine from a characteristic error', () => {
    assert.equal(fingerprintDb('syntax error at or near ")"').engine, 'postgres');
    assert.equal(fingerprintDb('You have an error in your SQL syntax; check the MySQL').engine, 'mysql');
    assert.equal(fingerprintDb('Unclosed quotation mark after the character string').engine, 'mssql');
    assert.equal(fingerprintDb('ORA-01756: quoted string not properly terminated').engine, 'oracle');
});

test('returns unknown when nothing matches', () => {
    const fp = fingerprintDb('<p>Welcome back, alice!</p>');
    assert.equal(fp.engine, 'unknown');
    assert.equal(fp.evidence, null);
});