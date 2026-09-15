export interface Finding {
    path: string;
    method: 'GET' | 'POST';
    field: string;                          // the field claimed injectable
    otherFields?: Record<string, string>;   // benign values for the other fields
    technique?: string;                     // hunter's guess: 'union' | 'boolean' | 'error'
    engine?: string;
    payload?: string;                       // hunter's payload (reference only)
    observed?: string;                      // what the hunter saw
}

export type Verdict = 'PROVEN' | 'SUSPECTED' | 'REJECTED';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface OracleEvidence {
    oracle: string;               // 'computational' | 'boolean' | 'error'
    passed: boolean;
    request: string;              // the injected value used
    expected?: string;
    actualSnippet: string;
    detail?: string;
}

export interface LlmOpinion {
    opinion: 'likely_true' | 'likely_false' | 'unsure';
    rationale: string;
}

export interface ValidationResult {
    finding: Finding;
    verdict: Verdict;             // AUTHORITATIVE — from deterministic oracles only
    techniques: string[];
    severity: Severity;
    evidence: OracleEvidence[];
    llm: LlmOpinion | null;       // ADVISORY only
    agreement: 'agree' | 'disagree' | 'n/a';
    note: string;
}