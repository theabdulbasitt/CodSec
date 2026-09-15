import type { Finding, ValidationResult, Verdict, Severity, OracleEvidence } from './types';
import { computationalOracle, booleanOracle, errorSignal } from './oracles';

export async function validate(finding: Finding): Promise<ValidationResult> {
    // DETERMINISTIC oracles — the only judge for now (LLM reviewer deferred).
    const comp = await computationalOracle(finding);
    const bool = await booleanOracle(finding);
    const err = await errorSignal(finding);
    const evidence: OracleEvidence[] = [comp, bool, err];
    const techniques = evidence.filter((e) => e.passed).map((e) => e.oracle);

    let verdict: Verdict;
    let severity: Severity;
    if (comp.passed) { verdict = 'PROVEN'; severity = 'high'; }        // arbitrary data read
    else if (bool.passed) { verdict = 'PROVEN'; severity = 'medium'; }  // execution proven, limited channel
    else if (err.passed) { verdict = 'SUSPECTED'; severity = 'low'; }   // looks injectable, unproven
    else { verdict = 'REJECTED'; severity = 'low'; }

    const note =
        verdict === 'PROVEN' ? `Confirmed via ${techniques.join(', ')} (deterministic).`
            : verdict === 'SUSPECTED' ? `Injectable-looking but no oracle confirmed — needs human review.`
                : `No injection effect reproduced — treated as false positive.`;

    return { finding, verdict, techniques, severity, evidence, llm: null, agreement: 'n/a', note };
}