# CodSec

An autonomous agent that finds **SQL-injection** vulnerabilities in a running web app and
**proves** each one by exploiting it to capture a hidden flag — then reports only what it
proved. Black-box (HTTP only), local targets only.

> ⚠️ **Offensive tooling.** This agent sends real attack payloads. It attacks **only**
> local, allow-listed targets you own. Pointing it at systems you do not own without written
> authorisation is illegal. See [SCOPE.md](SCOPE.md) for the full safety boundary.

## Status

Early build — following the step plan in [SCOPE.md](SCOPE.md). See that file for the full
project scope, the prove-by-flag mechanism, and the design decisions on record.

## Layout

```
CodSec/
├── SCOPE.md          # the founding scope document — read this first
├── agent/            # THE ATTACKER — TypeScript agent (this package)
│   └── tools/        # the agent's hands: http_request, fingerprint, ...
├── targets/          # THE VICTIMS — deliberately-vulnerable apps, one per folder,
│                     #   each in its own Docker container with a hidden flag
└── benchmark/        # Phase 2 — scoring the agent across all targets
```

The **agent** and the **targets** are two separate programs in one repo: the agent is
TypeScript; each target is its own small Express + SQLite app. The agent only ever talks to
a target over HTTP — it never reads the target's source.

## Setup (once dependencies are in place)

```bash
npm install
cp .env.example .env   # then add your OpenRouter key
```

Model and target URL are configured in `.env`. The model is a single swappable variable
(`AGENT_MODEL`) — free models get throttled or retired often, so nothing is hard-coded to
one provider.
