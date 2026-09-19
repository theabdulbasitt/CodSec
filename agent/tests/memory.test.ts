import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../memory';

test('dedup key ignores argument key order', () => {
    const m = new Memory();
    m.record('http_request', { method: 'POST', path: '/login', form: { a: '1', b: '2' } }, 'r1');
    const hit = m.alreadyTried('http_request', { form: { b: '2', a: '1' }, path: '/login', method: 'POST' });
    assert.equal(hit, 'r1');
});

test('dedup treats different values as distinct', () => {
    const m = new Memory();
    m.record('http_request', { path: '/s', query: { q: 'a' } }, 'r1');
    assert.equal(m.alreadyTried('http_request', { path: '/s', query: { q: 'b' } }), undefined);
});

test('dedup is case-sensitive on values (no false collisions)', () => {
    const m = new Memory();
    m.record('http_request', { q: 'Alice' }, 'r1');
    assert.equal(m.alreadyTried('http_request', { q: 'alice' }), undefined);
});

test('undefined fields do not affect the key', () => {
    const m = new Memory();
    m.record('http_request', { path: '/x', form: undefined }, 'r1');
    assert.equal(m.alreadyTried('http_request', { path: '/x' }), 'r1');
});

test('addForms accumulates and dedupes across calls', () => {
    const m = new Memory();
    m.addForms([{ action: '/login', method: 'POST', inputs: ['username', 'password'] }]);
    m.addForms([{ action: '/search', method: 'GET', inputs: ['q'] }]);
    m.addForms([{ action: '/login', method: 'POST', inputs: ['username', 'password'] }]); // dup
    assert.equal(m.forms.length, 2);
});

test('addForms keeps same-path forms that differ by method', () => {
    const m = new Memory();
    m.addForms([{ action: '/x', method: 'GET', inputs: ['a'] }]);
    m.addForms([{ action: '/x', method: 'POST', inputs: ['a'] }]);
    assert.equal(m.forms.length, 2);
});