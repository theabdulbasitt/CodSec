import type OpenAI from 'openai';
import { httpRequest } from './http';
import { discover } from './discover';

export const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'discover',
            description:
                'Fetch a page on the target and extract its forms (with input field names), HTTP method, action, and links. Use first to map the attack surface.',
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
                'Send an HTTP request to the target and receive {status, elapsedMs, headers, body}. This is how you probe for and exploit SQL injection. Put POST body fields in "form".',
            parameters: {
                type: 'object',
                properties: {
                    method: { type: 'string', enum: ['GET', 'POST'] },
                    path: { type: 'string', description: "e.g. '/login'" },
                    query: { type: 'object', additionalProperties: { type: 'string' }, description: 'querystring params' },
                    form: { type: 'object', additionalProperties: { type: 'string' }, description: 'urlencoded POST body fields' },
                },
                required: ['method', 'path'],
            },
        },
    },
];

type Handler = (args: any) => Promise<string>;

export const handlers: Record<string, Handler> = {
    discover: async (args) => JSON.stringify(await discover(args.path ?? '/')),
    http_request: async (args) => {
        const r = await httpRequest({
            method: args.method,
            path: args.path,
            query: args.query,
            form: args.form,
        });
        return JSON.stringify({
            url: r.url, status: r.status, elapsedMs: r.elapsedMs,
            headers: r.headers, body: r.body, truncated: r.truncated,
        });
    },
};