# Safety Exchange Cryptographic Profile v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

This profile defines the cryptographic behavior required to authenticate an exchange signal or
revocation. It does not turn a valid signature into evidence that the underlying observation is
true, sufficient, or actionable.

## Security goals

A conforming implementation MUST make it possible to detect record modification, unknown or
suspended issuers, expired keys, revoked keys, replayed identifiers, and a signature that was
created for a different protocol object.

## Canonical signing input

The v0.1 signing profile is `turnkeeper-exchange-ed25519-jcs-v1`.

1. Copy the complete protocol object.
2. Remove only its signature field: `origin_signature` or `broker_signature`.
3. Serialize the remaining object with the deterministic canonical JSON algorithm exported as
   `stableCanonicalJson` by the public SDK.
4. Prefix the UTF-8 bytes with the exact ASCII domain separator and a zero byte:
   `turnkeeper:safety-exchange:v0.1:<object-type>\0`.
5. Sign the resulting bytes with Ed25519.
6. Encode the 64-byte signature as unpadded base64url.

`<object-type>` MUST be one of `signal`, `revocation`, or `delivery`. A signature generated for one
object type MUST NOT validate for another. Producers MUST reject non-JSON values before
canonicalization. Implementations MUST NOT sign a digest alone unless a future profile explicitly
defines that construction.

The current SDK proves deterministic serialization and structural signature fields. Ed25519
signing and verification helpers remain Roadmap; a deployment MUST supply and independently review
that boundary before claiming `operational_conformant`.

## Verification

A verifier MUST:

1. validate the object schema before cryptographic processing;
2. resolve the key by member, environment, and `origin_key_id` or `broker_key_id`;
3. confirm the key was active at `issued_at` or `delivered_at`;
4. reject unknown, expired, revoked, or wrong-purpose keys;
5. reconstruct the canonical signing input exactly;
6. verify the Ed25519 signature in constant-time library code;
7. check expiry, revocation, purpose, membership, and idempotency separately; and
8. record the verification result without storing raw identifiers or evidence.

Successful signature verification proves only possession of the corresponding key and integrity of
the signed bytes. It MUST NOT be presented as confirmation of identity, guilt, policy violation, or
required action.

## Key lifecycle

- Signing keys MUST be generated and held in an approved hardware-backed or managed signing
  boundary.
- The same key MUST NOT sign production and non-production records.
- A key manifest MUST bind a key to one member, environment, allowed object types, activation time,
  and retirement time.
- Rotation MUST overlap long enough to validate unexpired records signed by the retiring key.
- A compromised key MUST be suspended immediately. New records from that key MUST fail closed.
- The operator MUST distribute a signed compromise notice and identify the earliest potentially
  affected issue time.
- Recipients MUST re-evaluate locally retained records covered by the compromise window.
- Private signing keys, raw identifier inputs, and VOPRF secret material MUST remain separate.

## Clock and freshness

Production profiles MUST declare an allowed clock skew no greater than five minutes. A verifier MUST
reject records issued unreasonably in the future and MUST apply expiry using its trusted clock. Clock
skew tolerance MUST NOT extend a record's declared expiration.

## Test vectors

Before operational use, the conformance suite MUST include:

- one valid signature for each object type;
- reordered-key input that produces the same canonical bytes;
- one-bit payload and signature mutations that fail;
- wrong-domain, wrong-object-type, wrong-member, expired-key, and revoked-key failures; and
- cross-language canonicalization vectors.

The repository's current fixtures use conspicuously synthetic signature placeholders and therefore
claim structural conformance only.
