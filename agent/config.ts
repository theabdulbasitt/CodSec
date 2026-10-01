import 'dotenv/config';

export const config = {
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    agentModel: process.env.AGENT_MODEL ?? 'openrouter/free',
    targetBaseUrl: process.env.TARGET_BASE_URL ?? 'http://localhost:8001',
};