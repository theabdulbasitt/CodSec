# CodSec

An autonomous AI agent that finds **SQL-injection** vulnerabilities in a running web app and
**proves** each one before reporting it. If it can't prove a bug by actually exploiting it,
it doesn't report it.

Built from scratch in TypeScript, no agent frameworks, as a way to really understand how
agentic systems work under the hood: tool-calling loops, sandboxing, memory, retries, and
(the part I care about most) separating *finding* a vulnerability from *proving* it.

> ⚠️ **Offensive tooling.** This agent sends real attack payloads. It only ever attacks
> local, allow-listed targets that I own and run myself. Pointing something like this at a
> system you don't have written permission to test is illegal. See [SCOPE.md](SCOPE.md).

## The problem this is really about

Finding "suspicious looking" code is easy. The hard part is **false positives.** LLMs are
trained to be helpful, so if you ask one "is there a vulnerability here?" it will often
confidently invent one that isn't there. A security tool that cries wolf gets turned off.

So CodSec is built as two parts that don't trust each other:

- **The hunter** — an LLM-driven agent that explores the app (black-box, HTTP only, no source
  access) and proposes where an injection might be.
- **The validator** — deterministic code that ignores the hunter's opinion and re-tests every
  claim itself. It only accepts a finding if it can make the app behave in a way that's
  *only* possible if the bug is real.

The hunter is the smart-but-fallible part. The validator is the dumb-but-certain part. That
split is what keeps hallucinated findings out of the report.

## How the validator proves a bug (without a planted flag)

Instead of relying on a secret hidden in the app, the validator generates its own proof on
the fly:

- **Computational check** — it makes the database compute something it invented this run
  (like a random marker plus some arithmetic). If that exact value comes back in the
  response, the injection genuinely executed. Can't be faked, works on any app.
- **Boolean check** — it sends a logically-true and a logically-false payload and confirms
  the app responds differently in a predictable way (compared against a normal baseline).
- **Error signal** — a leaked database error means "injectable-looking," but on its own it's
  treated as *suspected*, not proven.

Findings come out tiered: **PROVEN / SUSPECTED / REJECTED**, so a real bug is never lumped in
with a guess.

## What's here so far

- ✅ A sandboxed HTTP tool with a code-enforced "local targets only" safety wall
- ✅ Recon: black-box endpoint/form discovery + database fingerprinting from error dialects
- ✅ The hunter loop (tool-calling, memory, context summarization, retries)
- ✅ The oracle-based validator (deterministic proof, flag-free)
- ✅ Unit tests for the deterministic core
- 🔜 Wiring the hunter and validator into one auto-pipeline with a clean report
- 🔜 Effect-based proofs for apps with no reflected output (time-based / blind)
- 🔜 A benchmark across several targets (precision, requests per finding, cost) and a live view

Full plan and design decisions are in [SCOPE.md](SCOPE.md).

## Inspiration

The guiding idea — *prove it, don't guess it* — is heavily inspired by how tools like
**XBOW** and **Escape** approach validation and false-positive reduction. This is my own
from-scratch take on those ideas, scaled down to one vulnerability class and local targets,
for learning.

## Run it

```bash
npm install
cp .env.example .env      # add an OpenRouter API key

# start a target (in one terminal)
cd targets/001-login-sqli && npm install && npm start

# in another terminal, from the repo root
npm run agent             # the hunter
npm run validate          # the validator demo
npm test                  # the deterministic-core tests