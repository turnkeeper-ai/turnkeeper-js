# Safety Exchange Delivery and Lifecycle Profile v0.1

Status: **working draft**  
Applies to contract version: **2026-08-08**

This profile defines deterministic delivery behavior for signals and revocations. Durable broker
delivery remains Roadmap; these requirements describe the minimum boundary a future operator must
satisfy.

## Submission and idempotency

- A producer MUST use one stable `idempotency_key` for retries of the same logical signal.
- The operator MUST bind that key to the canonical record digest and origin member.
- A duplicate with the same digest MUST return the original receipt without redelivery.
- A duplicate key with a different digest MUST fail as `idempotency_conflict`, enter the audit log,
  and trigger member investigation when repeated.
- Retries MUST use bounded exponential backoff with jitter and MUST NOT extend expiry.

## Delivery and acknowledgement

The operator MUST create an append-only `ExchangeDeliveryRecordV1` for each recipient delivery.
Recipients MUST validate the broker signature, member authorization, schema, source signature,
purpose, issue time, expiry, and current revocation state before acknowledging acceptance.

Acknowledgements MUST distinguish:

- `accepted`: stored inside the permitted purpose boundary;
- `duplicate`: an identical delivery was already accepted;
- `rejected_permanent`: invalid schema, signature, purpose, membership, or expiry; and
- `retry_later`: a bounded local availability failure.

A transport-level acknowledgement MUST NOT imply that a reviewer confirmed the signal or opened a
case. Investigation state remains local.

## Ordering and replay

- Ordering is defined per `origin_member_id` and `signal_id`, not globally.
- A revocation received before its signal MUST create a tombstone that blocks later acceptance.
- A signal delivered after its expiry MUST be rejected.
- Replaying an accepted signal MUST return `duplicate` and MUST NOT reopen or escalate a local case.
- Operators and recipients MUST retain enough idempotency metadata to cover the signal lifetime and
  their approved audit window.

## Expiry

Every signal MUST expire. Until design-partner validation establishes category-specific limits,
production profiles MUST set a maximum lifetime of 31 days. Shorter member or jurisdictional limits
take precedence. Audit retention does not permit new investigation use after expiry.

## Correction

v0.1 has no correction object. A correction therefore requires:

1. revoking the original signal with `source_invalidated` or `policy_withdrawn`;
2. issuing a new signal with a new `signal_id`, authorization, provenance digest, and signature;
3. recording a protected local link between the old and new records; and
4. notifying every recipient of the revocation before or with the replacement.

The replacement MUST NOT reuse the original idempotency key. The exchange envelope does not expose
the local correction link in v0.1; an explicit `supersedes_signal_id` is a v0.2 candidate.

## Revocation and member suspension

- Revocations MUST use a priority delivery path and bypass ordinary signal queues.
- A recipient MUST stop new use immediately after validating a revocation.
- A future production operator MUST publish a measurable propagation objective; the v0.1 design
  target is acknowledgement by every reachable recipient within 15 minutes.
- Unreachable recipients MUST be retried and visibly reported to the origin member.
- Suspending a member MUST block new submissions and lookups. Its unexpired signals MUST enter
  quarantined review or receive `member_paused` revocations according to the operating agreement.
- A recipient MAY preserve an expired or revoked reference when legally required for appeal,
  incident response, or audit, but MUST mark it unusable for new decisions.

## Availability and fail-closed behavior

When membership, key, revocation, or purpose state cannot be verified, a recipient MUST quarantine
the delivery rather than accept it. Operators MUST NOT trade revocation freshness for availability.
Recovery procedures MUST replay revocations before ordinary signals and reconcile delivery receipts
without generating new local conclusions.
