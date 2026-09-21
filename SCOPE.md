# CodSec — Project Scope

## What this is
An autonomous agent that, given a **running web app**, finds injection-class vulnerabilities
and **proves** each one by actually exploiting it — then reports **only what it proved**.
Black-box (HTTP only, never reads the target's source).

Current focus is **SQL injection**; the hunter → validator → oracle design is built to
generalise to other vulnerability classes later.

## The core mechanism — prove by effect, not by opinion
A finding is only real if the agent can make the app do something that is **only possible if
the bug is real**, and capture that evidence. Proof comes from a deterministic check, never
from the model's confidence:

- The **hunter** (LLM) is smart but fallible — it searches for where a bug might be.
- The **validator** (plain code) is dumb but certain — it decides truth by reproducing an
  effect it can predict in advance.

The model proposes; the effect disposes. That split is what makes hallucinated findings
structurally impossible.

**On flags:** our own practice targets hide a secret ("flag") because it's the simplest
possible oracle for scoring. But the validator does **not** depend on a planted flag — it
generates its own proof (see below), so the same method works on any app with no flag present.

## How proof works (the oracles)
The validator re-tests the exact point the hunter flagged, with its **own** freshly generated
payloads (never a replay of the hunter's):

- **Computational** — make the DB compute a value the validator invents this run (a random
  marker + arithmetic). If that exact value comes back, the injection executed. Can't be faked.
- **Boolean-differential** — a logically-true vs logically-false payload must change the
  response predictably, compared against a baseline. The differential is what resists false
  positives.
- **Error signal** — a leaked DB error means "injectable-looking," but alone it is only
  *suspected*, not proven.
- **(Planned) time-based / blind** — prove execution by a reliable delay when there is no
  output channel at all.

Verdicts are tiered: **PROVEN / SUSPECTED / REJECTED**.

## In scope
- **SQL injection first** (depth before breadth). Error/UNION-based now; blind/time-based later.
- **Black-box recon by fingerprinting** — the agent discovers endpoints, forms, and the DB
  engine from responses/errors, because it is never told the stack.
- **Author our own targets** — deliberately-vulnerable Express + `node:sqlite` apps (each with
  a flag, purely to make scoring trivial).
- **A benchmark** (Phase 2) — precision, requests per finding, time, and cost across targets.

## Current focus & deliberate cuts
Other injection/vulnerability classes (XSS, SSRF, auth bypass, …) are **not permanently out of
scope** — the architecture is meant to generalise to them, and they are a planned extension
once SQLi is solid. They are simply not built yet.

## Absolute safety boundary
Offensive tooling that sends real payloads. The agent attacks ONLY localhost / 127.0.0.1
targets on an explicit allow-list, and REFUSES any other host. Attacking systems you don't
own without written authorisation is illegal. Modelled on three levers:
- **Motive** — the goal is proving a bug on a known local target, nothing else.
- **Method** — its only tools are HTTP requests; no shell, no wider network.
- **Opportunity** — a non-allow-listed host is refused before any request is sent.

## Confidence ladder — handling what the deterministic validator can't prove
The deterministic validator will never cover every case. When a technique doesn't apply, or a
finding needs more context than a single request gives, it must NOT be forced into a fake
PROVEN/REJECTED — it lands in **SUSPECTED**, carrying a `reason` for why it wasn't proven.
SUSPECTED findings escalate up a ladder, cheapest/strongest first:

1. **Broaden the deterministic oracles** — reach for another certain technique before anything
   fuzzy (time-based/blind when there's no output channel, error-based extraction, encoding
   variants). Prefer turning an edge case into a new oracle over leaving determinism.
2. **Close the loop with the hunter** — the validator returns *why it failed and what's
   missing*; the hunter gathers the missing context (a precondition, a session, an alternate
   channel) and re-reports with richer `otherFields`/setup. Handles the "needs more info" case.
3. **LLM adjudicator (advisory only)** — for genuinely ambiguous SUSPECTED cases, an LLM reads
   the raw evidence and gives an opinion + rationale to help triage. It may down-rank or flag,
   **never** promote to PROVEN.
4. **Human-in-the-loop** — SUSPECTED findings that survive the ladder go to a review queue with
   all evidence attached. A human is the only non-deterministic actor allowed to confirm.

**Invariant:** only deterministic proof OR a human confirms a finding. Fuzzy layers (LLM,
feedback loops) add capability around the certain core; they never move the trust guarantee.

## Build order
0. Repo skeleton (env, package, tsconfig)
1. Target #1 — vulnerable Express + node:sqlite app (with a flag for scoring)
2. Safety allow-list + `http_request` tool
3. Fingerprint + recon tools
4. The hunter loop (think → act → observe) on OpenRouter
5. The oracle validator — deterministic, effect-based proof  ← milestone
6. Memory + semantic retry + context summarization
7. Reporter + hunter→validator handoff (`report_finding`, severity, trace)
8. Effect-based proofs for no-output apps (time-based / blind) + the confidence ladder
   (Phase 2: more targets, benchmark table, live dashboard)

## Stack & model
- Agent: TypeScript. Targets: Express + node:sqlite (no native builds).
- Model via OpenRouter, one swappable env var `AGENT_MODEL`
  (primary `qwen/qwen3-coder:free`, fallback `z-ai/glm-4.5-air:free`).

## Decisions on record
| Decision | Choice |
|---|---|
| Direction | Live exploit agent + benchmark layer |
| Vuln class | SQL injection first (architecture generalises to other classes later) |
| Attack model | Pure black-box (maybe hybrid later) |
| Proof method | Effect-based oracles, deterministic validator (a flag is just one convenient oracle) |
| Exploitation depth | Error/UNION first; blind/time-based later |
| Target stack | Express + node:sqlite |
