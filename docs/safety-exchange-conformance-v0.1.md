# Safety Exchange Conformance Profile v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

Conformance is evidence about a bounded implementation, not certification that an organization is
safe, lawful, or fit to exchange live child-safety information.

## Claim levels

### `schema_conformant`

The implementation passes the machine-readable schema suite, public SDK validators, and positive
and negative synthetic fixtures. It MUST state that cryptographic verification, live membership,
durable delivery, and operational governance are outside this claim.

### `profile_conformant`

In addition to schema conformance, the implementation passes independently reproducible tests for
the cryptographic, private-match, delivery, and governance profiles it names. Partial profile claims
MUST list every omitted requirement.

### `operational_conformant`

In addition to all v0.1 profiles, a specific deployment has reviewed key management, membership,
delivery, incident response, safeguarding, privacy, challenge, and redress evidence. No current
Turnkeeper public SDK or hosted service claims this level.

## Required schema evidence

The schema suite at
[`spec/safety-exchange-2026-08-08.schema.json`](../spec/safety-exchange-2026-08-08.schema.json)
defines:

- `detectorCandidate`;
- `publishProposal`;
- `exchangeSignal`;
- `exchangeRevocation`;
- `matchLookupRequest`; and
- `exchangeDeliveryRecord`.

Implementations MUST reject additional properties, unsupported versions, prohibited purposes,
invalid enums, malformed opaque references, invalid digests, and invalid time ordering. Schema
success does not replace semantic, cryptographic, membership, expiry, or revocation checks.

## Fixture requirements

A conformance run MUST include:

- every object type in at least one valid synthetic fixture;
- prohibited raw content and direct-identifier fields;
- unknown fields at every nested boundary;
- unsupported version, identifier type, purpose, category, and evidence tier;
- malformed IDs, digests, signatures, and timestamps;
- issue/expiry and observation-window inversions;
- duplicate and conflicting idempotency cases;
- expired, revoked, suspended-member, and revocation-before-signal handling;
- private-match wrong-epoch, wrong-exchange, proof, and normalization cases; and
- canonical-signature mutation and cross-language vectors.

The repository initially publishes structural schema fixtures. Cryptographic and operational vectors
remain Roadmap and MUST be labeled as such until real verification code and independent review land.

## Conformance statement

A published statement MUST identify:

- implementation name and immutable version or commit;
- claimed level and profile revisions;
- contract date and schema identifiers;
- test-suite commit and execution date;
- runtime and dependency lock digest;
- every failure, exception, or untested requirement;
- reviewer or auditing organization; and
- a contact and expiration date for the statement.

Statements MUST expire after 90 days or when a material dependency, key boundary, schema, purpose,
identifier type, or deployment architecture changes.

## Prohibited claims

Passing conformance tests MUST NOT be described as proof that:

- a signal is accurate or identifies a person;
- a participant complies with all law or safeguarding duties;
- raw evidence cannot leak from its own systems;
- the protocol prevents every attack or harmful decision;
- Turnkeeper operates a live network; or
- any consequential action is authorized.

## Compatibility reporting

An implementation MAY use the wording “Turnkeeper Safety Exchange Protocol v0.1
`schema_conformant`” only after passing the exact public suite without modification. Forked schemas
or widened purposes MUST use a distinct name and MUST NOT claim v0.1 compatibility.
