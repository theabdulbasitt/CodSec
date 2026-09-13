import OpenAI from 'openai';
import { config } from './config';

export const llm = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: { 'X-Title': 'CodSec' },
});