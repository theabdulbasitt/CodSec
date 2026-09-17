import type OpenAI from 'openai';
import { chatWithRetry } from './llm';
import { config } from './config';
import { SYSTEM_PROMPT } from './prompt';
import { toolSchemas, makeHandlers } from './tools/registry';
import { Memory } from './memory';

const MAX_ITERATIONS = 12;

async function main() {
    if (!config.openrouterApiKey) {
        console.error('Missing OPENROUTER_API_KEY in .env');
        process.exit(1);
    }

    const memory = new Memory();
    const handlers = makeHandlers(memory);

    // messages[1] is a reserved slot we overwrite each turn with distilled memory.
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: 'CURRENT MEMORY:\n(none yet)' },
        { role: 'user', content: `Attack the target at ${config.targetBaseUrl} and capture the flag.` },
    ];

    for (let turn = 1; turn <= MAX_ITERATIONS; turn++) {
        console.log(`\n=== Turn ${turn} ===`);
        messages[1] = { role: 'system', content: 'CURRENT MEMORY:\n' + memory.summary() };

        console.log(`🧠 memory (context: ${messages.length} msgs)\n` + memory.summary().split('\n').map(l => '   ' + l).join('\n'));

        const res = await chatWithRetry({ model: config.agentModel, messages, tools: toolSchemas });
        const msg = res.choices[0].message;
        messages.push(msg);

        const reasoning = (msg as any).reasoning as string | undefined;
        if (reasoning?.trim()) console.log('💭', reasoning.trim());
        if (msg.content?.trim()) console.log('🤖', msg.content.trim());

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            console.log('\n✅ Agent finished.');
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
            console.log(`     → ${result}`);
            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }

        if (turn === MAX_ITERATIONS) console.log('\n⚠ Hit max iterations.');
    }

    console.log('\n\n\n===== RUN SUMMARY =====');
    console.log('\n\n\n--- final memory (distilled) ---\n' + memory.summary());
    console.log('\n\n\n--- tried requests (dedup keys) ---\n' + memory.triedList());
    console.log('\n\n\n--- notes ---\n' + (memory.notes.join('\n') || '(none)'));
    console.log(`\n\n\n--- context size: ${messages.length} messages ---`);

}

main().catch((err) => { console.error(err); process.exit(1); });