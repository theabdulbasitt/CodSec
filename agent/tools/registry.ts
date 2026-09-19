import type OpenAI from 'openai';
import { httpRequest } from './http';
import { discover } from './discover';
import { fingerprintDb } from '../recon/fingerprint';
import { digestHttp } from '../digest';
import type { Memory } from '../memory';

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
    };
}