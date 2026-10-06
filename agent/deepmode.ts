import type OpenAI from 'openai';
import { chatWithRetry } from './llm';
import { config } from './config';
import { httpRequest } from './tools/http';
import { digestHttp } from './digest';
import { computationalOracle, type InjectionContext } from './validator/oracles';
import type { Candidate } from './recon/crawl';
import type { ValidationResult } from './validator/types';

const MAX_STEPS = 10;
const short = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 100);

// ISSUE 2: turn a raw digest into a readable trace line — show status/len and the
// TAIL of the visible text (where the distinctive result is: "no such column", a
// username, "No account found"), not the nav boilerplate the head is full of.
function traceProbe(value: string, digest: string): string {
    try {
        const d = JSON.parse(digest);
        const text = String(d.text ?? '').replace(/\s+/g, ' ').trim();
        const tail = text.length > 90 ? '…' + text.slice(-90) : text;
        return `probe ${JSON.stringify(value)} → status=${d.status} len=${d.len} · ${tail}`;
    } catch {
        return `probe ${JSON.stringify(value)} → ${short(digest)}`;
    }
}

const SYSTEM = `You are a SQL-injection context analyst. A single field errored when probed with a quote, but the standard string-context oracles (which assume the input sits inside '...') could NOT exploit it. Your job: find the correct INJECTION CONTEXT so an automated oracle can prove it.

HOW TO FIND THE CONTEXT — compare behaviours with probe({value}):
- Send a number (e.g. "2"), a bare quote ("'"), and a word ("abc"), and compare the responses.
- Number works + quote errors  → NUMERIC context → prefix="0" or "-1" (no quotes around the input).
- Quote changes the response of a text field → STRING context → prefix="'".
- A value that returns NO rows makes the best prefix, so the only row shown is the one your UNION adds.

probe is for READ-ONLY reconnaissance only. Never send statements that modify data
(DROP/DELETE/UPDATE/INSERT/…) or stacked queries (;) — the validator proves the
injection safely with its own marker; you only need to identify the context.

When you know how to break out, call propose_context({prefix, comment, note}):
- prefix: text replacing the input that breaks out AND makes the original condition match no rows. e.g. "'" (quoted string), "0"/"-1" (numeric), "')" (parenthesised).
- comment: how to end the statement, usually "-- " (dash dash space) or "#".
- note: ONE short sentence naming the context you found and the evidence for it.

A validator then injects ITS OWN marker using your context. If it reflects, the finding is PROVEN. If your context fails, probe more and propose again.

RULES:
- You MUST call propose_context at least once before giving up (try prefix="0", then "'").
- Only call give_up after two failed propose_context attempts, with a concise reason.
- NEVER propose an empty prefix. Numeric field → "0" or "-1"; quoted string → "'".`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function', function: {
            name: 'probe', description: 'Send a READ-ONLY value into the field; see the response digest.',
            parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] }
        }
    },
    {
        type: 'function', function: {
            name: 'propose_context', description: 'Propose an injection context for the validator to verify.',
            parameters: { type: 'object', properties: { prefix: { type: 'string' }, comment: { type: 'string' }, note: { type: 'string' } }, required: ['prefix', 'comment'] }
        }
    },
    {
        type: 'function', function: {
            name: 'give_up', description: 'Call when no working context can be found.',
            parameters: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] }
        }
    },
];

async function sendProbe(c: Candidate, value: string): Promise<string> {
    const params = { ...(c.otherFields ?? {}), [c.field]: value };
    const r = c.method === 'GET'
        ? await httpRequest({ method: 'GET', path: c.path, query: params })
        : await httpRequest({ method: 'POST', path: c.path, form: params });
    return digestHttp(r);
}

export async function deepMode(candidate: Candidate, prior: ValidationResult): Promise<ValidationResult> {
    if (!config.openrouterApiKey) {
        return { ...prior, note: `Needs human review (deep-mode skipped: no API key). ${prior.reason ?? ''}`.trim() };
    }

    const how: string[] = [];          // HOW: what the hunter actually did
    let why = '';                      // WHY: the hunter's latest concise reasoning

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Field: ${candidate.method} ${candidate.path} field="${candidate.field}", other fields ${JSON.stringify(candidate.otherFields)}. A bare quote produced an error (${prior.reason ?? 'DB error leaked'}). Find the injection context.` },
    ];

    for (let step = 0; step < MAX_STEPS; step++) {
        const res = await chatWithRetry({ model: config.agentModel, messages, tools });
        const msg = res.choices[0].message;

        const reasoning = (msg as any).reasoning as string | undefined;
        if (msg.content?.trim()) why = msg.content.trim();
        else if (reasoning?.trim()) why = reasoning.trim();
        if (reasoning?.trim()) console.log('    💭', reasoning.trim().slice(0, 200));

        const assistant: OpenAI.Chat.Completions.ChatCompletionMessageParam = { role: 'assistant', content: msg.content ?? null };
        if (msg.tool_calls) (assistant as any).tool_calls = msg.tool_calls;
        messages.push(assistant);

        if (!msg.tool_calls?.length) break;

        for (const call of msg.tool_calls) {
            const args = JSON.parse(call.function.arguments || '{}');
            let result: string;

            if (call.function.name === 'probe') {
                const value = String(args.value ?? '');
                try {
                    const digest = await sendProbe(candidate, value);   // chokepoint may throw
                    result = digest;
                    how.push(traceProbe(value, digest));                // ISSUE 2: readable trace
                } catch (err: any) {
                    const m = err?.message ?? 'blocked by safety wall';
                    result = `Refused: ${m} Use read-only probes (numbers, quotes, words) to find the context.`;
                    how.push(`probe ${JSON.stringify(value)} → REFUSED (${String(m).slice(0, 60)})`);
                }
            } else if (call.function.name === 'propose_context') {
                let comment = String(args.comment ?? '-- ').trim();
                if (comment.startsWith('--') && !/\s$/.test(comment)) comment += ' '; // ISSUE 3: portable comment
                const ctx: InjectionContext = { prefix: String(args.prefix ?? ''), comment };
                console.log(`    ↳ propose_context(prefix="${ctx.prefix}", comment="${ctx.comment}")`);
                const ev = await computationalOracle(candidate, ctx);   // the validator decides truth
                how.push(`propose prefix="${ctx.prefix}" comment="${ctx.comment}" → ${ev.passed ? 'marker reflected ✓' : 'marker NOT reflected'}`);
                if (args.note) why = String(args.note);
                if (ev.passed) {
                    return {
                        ...prior,
                        verdict: 'PROVEN',
                        severity: 'high',
                        techniques: ['computational(deep)'],
                        evidence: [ev, ...prior.evidence],
                        reason: undefined,
                        note: `Proven in deep-mode via LLM-discovered context (prefix="${ctx.prefix}"). ${args.note ?? ''}`.trim(),
                        hunter: { why: why || `numeric/quoted context, prefix="${ctx.prefix}"`, how },
                    };
                }
                result = `That context did not reflect the marker (prefix="${ctx.prefix}"). Probe more and propose a different context, or give_up.`;
            } else if (call.function.name === 'give_up') {
                why = String(args.note ?? why ?? 'no working context found');
                return {
                    ...prior,
                    verdict: 'SUSPECTED',
                    note: `Needs human review (hunter could not prove a context).`,
                    hunter: { why, how },
                };
            } else {
                result = `Unknown tool ${call.function.name}`;
            }
            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
    }

    return {
        ...prior,
        verdict: 'SUSPECTED',
        note: `Needs human review (hunter exhausted its ${MAX_STEPS}-step budget without a proof).`,
        hunter: { why: why || `signal: ${prior.reason ?? 'error leaked'}`, how },
    };
}