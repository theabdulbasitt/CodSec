# CodSec — Project Scope

## What this is
An autonomous agent that, given a **running web app**, finds **SQL-injection** bugs and
**proves** each one by exploiting it to capture a hidden secret ("flag") — then reports
**only what it proved**. Black-box (HTTP only, never reads the target's source).

## The core mechanism — prove-by-flag
Each target hides a flag reachable ONLY by exploiting the bug. The agent's exploit either
extracts the flag or it doesn't:
- flag in the response  → exploit worked → CONFIRMED (with the exact request that did it)
- no flag               → no proof       → agent must NOT claim a finding; retry or stop

The LLM is the smart-but-fallible part that searches for a working exploit; the flag check
is the dumb-but-certain part that decides truth. This makes hallucinated findings impossible.

## In scope
- One class: SQL injection.
- Error/UNION-based exploitation first (DB leaks data into the response). Blind SQLi later.
- Recon by fingerprinting: the agent discovers the DB engine from headers/errors/probes,
  because it is black-box and isn't told the stack.
- Targets we author: vulnerable Express + `node:sqlite` apps, each with a hidden flag.
- A benchmark (Phase 2): flags captured, requests per capture, time, cost.

## Out of scope (deliberate cuts)
- ❌ Other vuln classes (XSS, SSRF, auth bypass).
- ❌ Attacking anything not owned and run locally.
- ❌ Fixing/patching code.
- ❌ Reading the target's source.

## Absolute safety boundary
Offensive tooling that sends real payloads. The agent attacks ONLY localhost / 127.0.0.1
targets on an explicit allow-list, and REFUSES any other host. Attacking systems you don't
own without written authorisation is illegal. 
- Motive — goal is capturing a flag on a known local target, nothing else.
- Method — its only tools are HTTP requests; no shell, no wider network.
- Opportunity — a non-allow-listed host is refused before any request is sent.

## Build order
0. Repo skeleton (env, package, tsconfig)
1. Target #1 — vulnerable Express + node:sqlite app with a flag
2. Safety allow-list + `http_request` tool
3. Fingerprint + recon tools
4. The agent loop (think → act → observe) on OpenRouter
5. The validator (flag check) → first captured flag  ← milestone
6. Memory + semantic retry + context summarization
7. Reporter — flag + request + severity + trace
8. Effect-based proofs (version()/current-db and time-based (sleep)) for targets with no flag
   (Phase 2: more targets, benchmark table, live dashboard)

## Stack & model
- Agent: TypeScript. Targets: Express + node:sqlite (no native builds).
- Model via OpenRouter, one swappable env var `AGENT_MODEL`
  (primary `qwen/qwen3-coder:free`, fallback `z-ai/glm-4.5-air:free`).

## Decisions on record
| Decision | Choice |
|---|---|
| Direction | Live exploit agent + benchmark layer |
| Vuln class | SQL injection only |
| Attack model | Pure black-box |
| Exploitation depth | Error/UNION first; blind later |
| Target stack | Express + node:sqlite |