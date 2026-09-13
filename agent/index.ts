import type OpenAI from 'openai';
import { llm } from './llm';
import { config } from './config';
import { SYSTEM_PROMPT } from './prompt';
import { toolSchemas, handlers } from './tools/registry';

const MAX_ITERATIONS = 12; // budget: never loop forever

async function main() {
    if (!config.openrouterApiKey) {
        console.error('Missing OPENROUTER_API_KEY in .env — get one at https://openrouter.ai/keys');
        process.exit(1);
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Attack the target at ${config.targetBaseUrl} and capture the flag.` },
    ];

    for (let turn = 1; turn <= MAX_ITERATIONS; turn++) {
        console.log(`\n=== Turn ${turn} ===`);

        const res = await llm.chat.completions.create({
            model: config.agentModel,
            messages,
            tools: toolSchemas,
        });

        const msg = res.choices[0].message;
        messages.push(msg);

        if (msg.content) console.log('🤖', msg.content);

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            console.log('\n✅ Agent finished (no more tool calls).');
            break;
        }

        for (const call of msg.tool_calls) {
            const name = call.function.name;
            let result: string;
            try {
                const args = JSON.parse(call.function.arguments || '{}');
                console.log(`   ↳ ${name}(${call.function.arguments})`);
                result = handlers[name] ? await handlers[name](args) : `Error: unknown tool ${name}`;
            } catch (err) {
                result = `Error running ${name}: ${(err as Error).message}`;
            }
            // const preview = result.length > 300 ? result.slice(0, 300) + '…' : result;
            const preview = result;
            console.log(`     → ${preview}`);
            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }

        if (turn === MAX_ITERATIONS) console.log('\n⚠ Hit max iterations without finishing.');
    }
    console.log("----------------------------------")
    //console.log(messages);
    console.dir(messages, { depth: null });   // or: JSON.stringify(messages, null, 2)
}

main().catch((err) => { console.error(err); process.exit(1); });