import type OpenAI from 'openai';
import { httpRequest } from './http';
import { discover } from './discover';
import { fingerprintDb } from '../recon/fingerprint';
import { digestHttp } from '../digest';
import type { Memory } from '../memory';
import { validate } from '../validator';
import type { Finding } from '../validator/types';

export const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'discover',
            description:
                'Fetch a page and extract its forms (with field names), method, action, and links. Use first to map the attack surface.',
            parameters: {
                type: 'object',
                properties: { path: { type: 'string', description: "Path to fetch, e.g. '/'" } },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'http_request',
            description:
                'Send an HTTP request to the target and receive a compact digest {status, ms, len, body}. This is how you probe for and exploit SQL injection. Put POST body fields in "form".',
            parameters: {
                type: 'object',
                properties: {
                    method: { type: 'string', enum: ['GET', 'POST'] },
                    path: { type: 'string', description: "e.g. '/login'" },
                    query: { type: 'object', additionalProperties: { type: 'string' } },
                    form: { type: 'object', additionalProperties: { type: 'string' } },
                },
                required: ['method', 'path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'report_finding',
            description:
                'Report a suspected SQL-injection point once you have observed a field reacting to injection (an error, or your input changing the response). An independent validator re-tests it with its OWN payloads and returns a verdict (PROVEN/SUSPECTED/REJECTED). You do NOT need to fully exploit it yourself.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: "e.g. '/login'" },
                    method: { type: 'string', enum: ['GET', 'POST'] },
                    field: { type: 'string', description: 'the injectable field name' },
                    otherFields: { type: 'object', additionalProperties: { type: 'string' }, description: 'benign values for the OTHER fields on that request, e.g. {"password":"x"}' },
                    technique: { type: 'string', description: 'union | boolean | error' },
                    observed: { type: 'string', description: 'what you saw that suggests injection' },
                },
                required: ['path', 'method', 'field'],
            },
        },
    },
];

export function makeHandlers(memory: Memory): Record<string, (args: any) => Promise<string>> {
    return {
        discover: async (args) => {
            const d = await discover(args?.path ?? '/');
            memory.addForms(d.forms);
            return JSON.stringify({ forms: d.forms, links: d.links });
        },

        http_request: async (args) => {
            const dup = memory.alreadyTried('http_request', args);
            if (dup) {
                return `(You already sent this exact request. Its result was: ${dup}. Try a DIFFERENT payload.)`;
            }
            const r = await httpRequest({ method: args.method, path: args.path, query: args.query, form: args.form });
            const fp = fingerprintDb(r.body);
            if (fp.engine !== 'unknown' && !memory.engine) memory.engine = fp.engine;
            const digest = digestHttp(r);
            memory.record('http_request', args, digest);
            return digest;
        },
        report_finding: async (args) => {
            const existing = memory.findingFor(args.path, args.method, args.field);
            if (existing) {
                return `Already validated ${args.method} ${args.path} field=${args.field}: ${existing.verdict}. Move on to other fields/endpoints.`;
            }
            const finding: Finding = {
                path: args.path,
                method: args.method,
                field: args.field,
                otherFields: args.otherFields,
                technique: args.technique,
                observed: args.observed,
            };
            const result = await validate(finding);   // ← the handoff: validate immediately
            memory.addFinding(result);
            const reasonPart = result.reason ? ` reason: ${result.reason}.` : '';
            return `Validator verdict: ${result.verdict} (severity=${result.severity}, techniques=[${result.techniques.join(', ') || 'none'}]).${reasonPart}`;
        },
    };
}