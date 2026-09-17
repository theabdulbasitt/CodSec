import OpenAI from 'openai';
import { config } from './config';

export const llm = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'X-Title': 'CodSec' },
});

const RETRIES = 3;

export async function chatWithRetry(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) {
    let lastErr: unknown;
    for (let i = 1; i <= RETRIES; i++) {
        try {
            return await llm.chat.completions.create(params);
        } catch (err: any) {
            lastErr = err;
            const status = err?.status ?? err?.response?.status;
            const transient = status === 429 || status === undefined || (status >= 500 && status < 600);
            console.warn(`⚠ LLM call failed (attempt ${i}/${RETRIES}, status=${status}). ${transient && i < RETRIES ? 'retrying…' : 'giving up.'}`);
            if (!transient || i === RETRIES) break;
            await new Promise((r) => setTimeout(r, 800 * i)); // linear backoff
        }
    }
    throw lastErr;
}