# CodSec — Task Board

A living checklist for the SQL-injection agent. Keep it current: move items between
sections as work lands. SQLi is finished *first*; multi-vuln comes only after.

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

---

## In progress

- [~] **Deep-mode hunter reliability** — hunter reinvestigates SUSPECTED findings
  (probe → reason out context → hand context to validator). Recent fixes: reject
  empty prefix before spending an oracle call, raise step budget to 10, prompt rule
  against empty prefix. Verifying `/account` proves consistently across runs.

## To do (near-term, still SQLi)

- [ ] Confirm `/account` (numeric context) proves on 3+ consecutive runs after the
      empty-prefix + budget fixes.
- [ ] Commit the milestone: deep-mode hunter + egress safety guard + test fixes.
- [ ] Decide fate of dormant hunter leftovers (`prompt.ts`, `registry.ts`
      `report_finding`, hunter parts of `memory.ts`): delete vs. keep with a
      "dormant" comment. (Leaning: keep `prompt.ts` dormant.)
- [ ] **Time-based / blind oracle** — prove injection with a conditional delay
      (`... AND SLEEP(5)`) measured via `elapsedMs`. Unlocks blind SQLi where no
      output reflects. Biggest current coverage gap.

## Done

- [x] Deterministic 3-phase pipeline: crawl → validate → deep-mode → report.
- [x] BFS crawler builds a candidate queue (forms + query params), dedup + ids.
- [x] Oracle-based proof, flag-free: computational (marker + arithmetic),
      boolean-differential, error-signal. Verdicts PROVEN / SUSPECTED / REJECTED.
- [x] Injection-context generalization (`{prefix, comment}`): string + numeric.
- [x] Deep-mode hunter surfaces **result + why (reasoning) + how (probe trace)**
      in the report for SUSPECTED findings.
- [x] **Three-layer safety**, enforced in code not prompt:
      (1) scope lock — `assertAllowedUrl`, localhost-only, throws;
      (2) egress chokepoint — `assertNonDestructive` in `http.ts`, blocks DDL/DML +
          stacked queries for every request/tool/oracle;
      (3) non-destructive by construction — oracle payloads are read-only templates.
- [x] Readable `how` trace (`traceProbe`: status/len + tail of visible text).
- [x] Portable SQL comment normalization (`--` → `-- ` for MySQL).
- [x] Tests: safety (scope + non-destructive), memory dedup/addForms, fingerprint,
      discover(parsePage), digest (updated to the `visibleText` contract).
- [x] SCOPE.md / README.md rewritten to the effect-based proof model.

## Further / future tasks (backlog)

- [ ] **Signal-aware digest truncation** — digest currently keeps the first 240
      chars; a huge response could bury the signal mid-body. Fine today (target
      pages are short; `traceProbe` reads the tail). Revisit if targets get large.
- [ ] **Multi-engine support** — marker concat is SQLite/Postgres (`||`); make it
      engine-aware (`CONCAT()` for MySQL) so contexts prove beyond SQLite.
- [ ] **Second target** — a different app to prove the pipeline generalizes
      (not overfit to target-001).
- [ ] **Benchmark / scoring layer** — precision (false-positive rate),
      requests-per-finding, token cost per run.
- [ ] **Confidence-ladder rungs beyond deep-mode** — broader oracles, then
      LLM adjudicator (advisory), then human-in-the-loop. Invariant holds:
      only deterministic proof OR a human promotes to PROVEN; the LLM never does.
- [ ] **Harder edge cases** — WAF/keyword filtering (needs evasion),
      parenthesized / second-order / stacked contexts, column-count/type mismatch.
- [ ] **Multi-vuln architecture** — detector-registry / plugin pattern
      (Open/Closed). Deferred until SQLi is complete and vuln types are studied.
- [ ] **Audit trail** — persist the full request/response log per run alongside
      `runs/report-*.json` (XBOW-style immutable trace).
