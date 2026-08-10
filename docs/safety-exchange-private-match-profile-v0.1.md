# Safety Exchange Private-Match Profile v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

This profile defines how members determine whether they hold the same verified contact point
without publishing that identifier or a reusable unsalted hash. A raw SHA-256 hash of an email
address or telephone number is non-conformant because it can be enumerated offline.

## Supported inputs

v0.1 supports only `verified_email` and `verified_phone`. The member MUST already have a documented
basis for treating the identifier as verified. Usernames, display names, advertising identifiers,
device fingerprints, IP addresses, embeddings, and inferred identities are prohibited.

### Email normalization

Before blinding, a producer MUST:

1. remove leading and trailing ASCII whitespace;
2. require exactly one usable `@` separator;
3. normalize the domain to its lowercase IDNA ASCII form;
4. preserve the local part exactly after Unicode NFC normalization; and
5. reject control characters, invalid UTF-8, and an empty local or domain part.

The protocol MUST NOT remove dots, strip plus tags, or otherwise apply provider-specific aliases.
Those transformations can join accounts that the provider treats as distinct.

### Telephone normalization

A producer MUST convert a verified phone number to E.164 using its known region context. The input
MUST contain a country calling code after normalization and MUST NOT contain an extension. A member
that lacks enough information to create one unambiguous E.164 value MUST not submit the identifier.

## VOPRF construction

The implemented request contract identifies `turnkeeper-private-match-v1` and the
`ristretto255-SHA512` ciphersuite. A conforming client MUST:

1. frame the normalized input as UTF-8
   `turnkeeper:private-match:v1\0<identifier_type>\0<normalized_identifier>`;
2. blind the framed input locally using a reviewed VOPRF implementation;
3. send only the blinded element with exchange, environment, key epoch, type, and purpose;
4. verify the provider proof and key manifest before accepting an evaluated element; and
5. derive the 64-character `match_handle` as lowercase hex SHA-256 over
   `turnkeeper:match-handle:v1\0<exchange_id>\0<key_epoch>\0<evaluated_output>`.

The VOPRF provider MUST never receive the normalized identifier. The exchange operator MUST never
receive the blinding scalar. The client MUST erase identifier and blinding intermediates as soon as
the match handle has been derived.

The public SDK currently defines request, response, and manifest types and validates evaluation
request shapes. It does not yet validate every manifest, implement the full client cryptography, or
supply a production provider. This construction is therefore a design target until independent
vectors and provider review are complete.

## Unlinkability and epochs

- Every exchange environment MUST use independent VOPRF keys.
- Keys SHOULD rotate monthly and MUST identify an epoch.
- A handle from one exchange or epoch MUST NOT be comparable with a handle from another.
- Epoch overlap MUST be bounded and documented; broad historical rematching is prohibited.
- Signal expiry MUST NOT be extended merely because a new epoch produces the same local match.
- Audit records MAY retain opaque lookup references, never normalized identifiers or blindings.

## Enumeration and traffic analysis

- Lookups MUST require authenticated membership and an allowed purpose.
- Operators MUST enforce per-member and per-purpose rate limits, anomaly detection, and bounded
  batch sizes.
- A member MUST NOT submit a list acquired for bulk screening, model training, marketing, or global
  reputation.
- Responses SHOULD be shaped to reduce match/no-match timing differences.
- Logs MUST avoid blinded elements, evaluated elements, match handles, and normalized identifiers
  unless a narrowly approved security event requires temporary protected capture.
- Repeated probing, sequential identifier generation, or unexplained lookup growth MUST suspend
  lookup authority pending human review.

## False matches and false non-matches

A match is a routing hint for local review, not proof that two accounts represent the same person.
Recipients MUST consider recycled phone numbers, shared family contact points, compromised accounts,
normalization differences, and identifier reassignment. A non-match MUST NOT be presented as proof
that no related risk exists.
