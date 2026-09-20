import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage } from '../tools/discover';

test('extracts a form with action, method, and named inputs', () => {
    const html = `<form method="post" action="/login">
    <input name="username"><input name="password" type="password">
    <button>go</button></form>`;
    const { forms } = parsePage(html, '/login');
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0], { action: '/login', method: 'POST', inputs: ['username', 'password'] });
});

test('defaults action to current path and method to GET', () => {
    const { forms } = parsePage('<form><input name="q"></form>', '/search');
    assert.deepEqual(forms[0], { action: '/search', method: 'GET', inputs: ['q'] });
});

test('captures textarea/select and skips inputs without a name', () => {
    const html = `<form action="/f" method="post">
    <input type="submit">
    <textarea name="message"></textarea>
    <select name="topic"></select></form>`;
    const { forms } = parsePage(html, '/');
    assert.deepEqual(forms[0].inputs, ['message', 'topic']);
});

test('collects and dedupes links', () => {
    const html = `<a href="/a">A</a><a href="/b">B</a><a href="/a">A again</a>`;
    const { links } = parsePage(html, '/');
    assert.deepEqual(links, ['/a', '/b']);
});

test('parses multiple forms on one page', () => {
    const html = `<form action="/x" method="get"><input name="a"></form>
                <form action="/y" method="post"><input name="b"></form>`;
    const { forms } = parsePage(html, '/');
    assert.equal(forms.length, 2);
});