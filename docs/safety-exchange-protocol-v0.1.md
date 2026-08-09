# Turnkeeper Safety Exchange Protocol v0.1

Status: **working draft**
Contract version: **2026-08-08**

Turnkeeper Safety Exchange Protocol v0.1 defines a privacy-minimized envelope for moving bounded
safety signals between authorized systems without moving raw evidence or transferring enforcement
authority.

This is a proposal for design-partner review, not an adopted industry standard. The TypeScript
contracts and validators are **Implemented** with synthetic data. A live multi-company network,
governed membership, provider integrations, and shared case rooms remain **Roadmap**.

## Design goal

A recipient should be able to answer:

- who issued the signal;
- what bounded observation it describes;
- which purpose permits its use;
- which policy and evidence tier shaped it;
- when it expires;
- whether it was corrected or revoked; and
- which local review and action, if any, followed.

The protocol standardizes evidence exchange and accountability metadata. It does not standardize a
person's identity, a universal danger score, a policy conclusion, or an enforcement outcome.

## Implemented contract foundations

The current public SDK implements and validates:

- **DetectorCandidateV1** for customer-hosted detector output;
- **PublishProposalV1** for a locally authorized contribution proposal;
- **ExchangeSignalEnvelopeV1** for a signed, expiring exchange signal;
- **ExchangeRevocationV1** for append-only withdrawal;
- **MatchLookupRequestV1** for a purpose-bound local lookup;
- **ExchangeDeliveryRecordV1** for broker delivery evidence;
- deterministic canonical JSON and SHA-256 digests; and
- synthetic private-match request and response contracts.

Source: [exchange contracts](../packages/sdk/src/ward/exchange.ts) and
[private-match contracts](../packages/sdk/src/ward/private-match.ts).

Implemented here means code-backed public contracts and passing tests. It does not imply live
participants, live feeds, an official provider relationship, or production authorization.

## Boundary

### Allowed

- opaque member, signal, case, and subject references;
- bounded safety categories and strength bands;
- evidence tiers and customer-held evidence digests;
- observation windows;
- purpose and policy references;
- issue and expiry timestamps;
- provenance digests, key identifiers, and signatures; and
- revocation records.

### Prohibited

- messages, prompts, completions, summaries, or transcripts;
- raw media, attachments, provider payloads, or URLs;
- names, usernames, email addresses, phone numbers, or other direct identifiers;
- embeddings, unconstrained explanations, or raw model scores;
- model training, bulk screening, or global reputation uses;
- automatic enforcement or parent notification; and
- treating a received signal as a legal conclusion or confirmed identity.

The SDK rejects prohibited content-shaped fields at the exchange boundary.

## Roles

### Origin member

Runs its own detector or investigation, retains raw evidence, authorizes a bounded contribution,
signs the envelope, and owns any later correction or revocation.

### Recipient member

Matches locally, evaluates the signal under its own policy and evidence, records counterevidence,
and independently decides whether any investigation or response is appropriate.

### Exchange operator

Authenticates members, delivers signed envelopes and revocations, records delivery evidence, and
enforces the shared operating agreement. This governance role is **Roadmap**; it is not supplied by
the public SDK.

### Turnkeeper case layer

Can reconstruct source-linked trajectories and preserve review and authorization evidence. A live
multi-company case workspace is **Roadmap** and is not defined as an implemented v0.1 service.

## Signal lifecycle

    local observation
      -> detector candidate
      -> locally reviewed publish proposal
      -> signed exchange signal
      -> purpose-bound local match
      -> independent recipient investigation
      -> optional local action
      -> expiry, correction, or revocation

Observations, inferences, adjudications, and actions remain separate records. Receiving a signal
never authorizes a downstream action.

## Envelope anatomy

The canonical shape is **ExchangeSignalEnvelopeV1**:

    {
      "schema_version": "2026-08-08",
      "signal_id": "signal_synthetic_01",
      "idempotency_key": "signal_idempotency_01",
      "origin_member_id": "member_synthetic_a",
      "identifier_type": "verified_email",
      "match_handle": "<64-character opaque digest>",
      "category": "boundary_testing",
      "signal_strength_band": "elevated",
      "evidence_tier": "window_available",
      "observed_window": {
        "started_at": "2026-08-08T00:00:00.000Z",
        "ended_at": "2026-08-08T00:03:00.000Z"
      },
      "purpose": "local_investigation",
      "policy_ref": "exchange_policy_v1",
      "policy_version": "2026-08-08",
      "issued_at": "2026-08-08T00:05:00.000Z",
      "expires_at": "2026-09-08T00:05:00.000Z",
      "provenance_digest": "<64-character SHA-256 digest>",
      "authorization_artifact_id": "authz_synthetic_01",
      "origin_signature": "<base64url signature>",
      "origin_key_id": "member_key_synthetic_a"
    }

The [synthetic collaboration fixture](examples/safety-exchange-v0.1.synthetic.json) contains two
independent signals, a revocation, and illustrative company-local review outcomes. Only its
exchange envelopes and revocation are protocol objects; local outcomes remain local and are not
shared conclusions.

## Purpose limitation

v0.1 allows three declared purposes:

- **local_investigation**
- **specialist_review**
- **audit_retention**

The following purposes are forbidden by the public contract:

- **model_training**
- **global_reputation**
- **automated_enforcement**
- **parent_notification**
- **bulk_screening**

An operator agreement may narrow permitted use further. It must not silently widen the public
contract.

## Expiry, correction, and revocation

- Every exchange signal has an expiry timestamp after its issue timestamp.
- Corrections create new signed records; they do not silently rewrite history.
- A revocation identifies its source member, original signal, reason, issue time, signature, and
  key.
- Recipients must stop new use of expired or revoked signals and apply their approved retention and
  redress rules to existing local cases.

## Independent review and action

Each recipient applies its own:

- policy and jurisdiction;
- local evidence and counterevidence;
- reviewer authorization requirements;
- correction and appeal procedures; and
- execution controls.

The protocol must not become a shared blacklist. No exchange signal independently authorizes an
account restriction, report, outreach, preservation request, or other consequential action.

## Conformance

A v0.1 producer or consumer should:

1. emit only the exact versioned fields;
2. reject unknown and prohibited content-shaped fields;
3. validate purpose, evidence tier, time bounds, and identifier type;
4. verify issuer and broker signatures at its trust boundary;
5. process idempotency and duplicate conflicts deterministically;
6. apply expiry and revocation fail-closed;
7. keep raw evidence and private matching inputs local; and
8. preserve an append-only audit trail for delivery and local review.

The public SDK currently proves structural validation and synthetic contract behavior. Production
key management, membership, governance, durable delivery, and operational conformance certification
remain outside this working draft.

## Design-partner questions

The first design-partner round should test one synthetic harm trajectory and answer:

- Can existing platform taxonomies map into the bounded categories without losing essential
  meaning?
- Is the purpose model narrow enough to prevent secondary use?
- Can a weak signal be challenged, corrected, and revoked quickly enough?
- What governance entity and membership rules are required before any live exchange?
- What evidence is necessary for independent review without transferring raw content?

[Start with one workflow](https://turnkeeper.ai/pilot) or open a narrowly scoped proposal through
the repository's contribution process.

## Non-claims

This draft does not claim compatibility with or endorsement by Lantern, ThreatExchange, Osprey, or
any detector vendor. It does not create a live exchange, information-sharing authority, legal
reporting system, or autonomous enforcement service.
