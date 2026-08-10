# Safety Exchange Threat Model v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

This threat model covers the protocol boundary and its reference contracts. It does not claim that
a future hosted operator, member deployment, or provider is secure.

## Protected assets

- raw safety evidence and direct identifiers held by each member;
- the unlinkability of private-match inputs across exchanges and epochs;
- integrity and provenance of signals, revocations, and delivery records;
- purpose, expiry, membership, and human-review controls;
- affected people's ability to receive correction and redress; and
- reviewer independence from unsupported or manipulated conclusions.

## Trust assumptions

- Each member controls its local evidence, policy, reviewers, and final actions.
- A signature identifies an authorized key, not the truth of an observation.
- The operator is trusted for membership and delivery governance but is not trusted with raw
  identifiers, raw evidence, or enforcement authority.
- The VOPRF provider and operator are assumed not to collude. A production design MUST document how
  this separation is enforced and what happens if it fails.
- Endpoints, members, insiders, and dependencies may be compromised.

## Threats and required mitigations

| Threat | Example | Required mitigation |
| --- | --- | --- |
| Offline identifier enumeration | Hashing common emails to discover a match | VOPRF profile; prohibit raw hashes; rate limits and independent keys |
| Cross-exchange tracking | Comparing one person's handle across partners | Exchange- and epoch-scoped derivation; bounded overlap |
| False or malicious publication | A member submits unsupported allegations | Local publication authority; provenance; narrow distribution; challenge and suspension |
| Automated enforcement | A recipient blocks an account on receipt | Independent human review; separate local adjudication and execution authorization |
| Raw-content smuggling | Free text or URLs appear in an optional field | Exact schemas, unknown-field rejection, prohibited-key scanning, size bounds |
| Replay and duplicate amplification | Retried delivery repeatedly escalates a case | Digest-bound idempotency; duplicate acknowledgement; no case reopening |
| Revocation suppression | An operator delays withdrawal of a bad signal | Priority revocation channel, tombstones, acknowledgements, visible delivery gaps |
| Key compromise | An attacker signs plausible signals | Hardware-backed keys, short activation windows, suspension, compromise notices, re-evaluation |
| Purpose laundering | Investigation data is reused for training | Purpose-bound lookup and retention; audits; sanctions; no silent widening |
| Membership abuse | A participant performs bulk screening | Separate permissions, rate limits, anomaly detection, immediate suspension |
| Taxonomy drift | Different platforms interpret a category differently | Versioned mapping, bounded definitions, local corroboration, no universal conclusion |
| Insider curiosity | A reviewer searches a person without a case | Case-bound lookup, least privilege, access logs, review and sanctions |
| Traffic analysis | Volume or timing reveals a sensitive event | Minimized logs, batching/padding where justified, bounded operational access |
| Availability failure | Stale key or revocation state is unavailable | Quarantine and fail closed; restore revocations before signals |
| Collusion | Operator and VOPRF provider combine observations | Organizational separation, independent audit, key epochs, documented residual risk |

## Child-specific harms

The protocol could amplify a mistaken identity, expose a vulnerable child through correlation,
discourage help-seeking, or cause disproportionate intervention. Implementations MUST minimize
collection, avoid stigmatizing labels, preserve uncertainty, account for shared or recycled contact
points, and require evidence beyond the exchanged signal before consequential action.

## Out of scope but required before production

- deployment-specific infrastructure and network security;
- legal analysis for participating jurisdictions;
- provider and hardware security assessments;
- incident staffing and notification obligations;
- independent safeguarding and privacy impact assessments; and
- adversarial exercises with design partners.

## Residual risks

Even with all profiles implemented, metadata can reveal relationships, honest members can disagree,
verified identifiers can be reassigned or shared, reviewers can make mistakes, and governance can
fail. No conformance claim may state that the protocol eliminates harm, proves identity, or makes a
signal safe for automatic action.

The threat model MUST be revisited for every new identifier type, purpose, category, transport,
provider, jurisdiction, or participant class.
