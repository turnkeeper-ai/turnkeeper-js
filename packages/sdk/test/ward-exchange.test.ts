import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXCHANGE_CONTRACT_VERSION,
  PRIVATE_MATCH_CIPHERSUITE,
  PRIVATE_MATCH_PROTOCOL,
  digestCanonical,
  validateExchangeDeliveryRecordV1,
  validateExchangeSignalV1,
  validateMatchLookupRequestV1,
  validatePrivateMatchEvaluationRequestV1,
  validatePublishProposalV1,
} from "../src/index.js";

const proposal = {
  schema_version: EXCHANGE_CONTRACT_VERSION,
  proposal_id: "proposal_00000001",
  idempotency_key: "proposal_idempotency_01",
  tenant_id: "tenant_00000001",
  candidate_id: "candidate_00000001",
  subject_ref: "subject_00000001",
  identifier_type: "verified_email",
  identifier_commitment: "a".repeat(64),
  category: "boundary_testing",
  signal_strength_band: "elevated",
  evidence_tier: "window_available",
  observed_window: {
    started_at: "2026-08-08T00:00:00.000Z",
    ended_at: "2026-08-08T00:01:00.000Z",
  },
  purpose: "local_investigation",
  expires_at: "2026-08-09T00:00:00.000Z",
  policy_ref: "exchange_policy_v1",
  policy_version: "2026-08-08",
  created_at: "2026-08-08T00:02:00.000Z",
};

test("validates exchange proposals and rejects plaintext identifier fields", () => {
  assert.equal(validatePublishProposalV1(proposal).ok, true);
  assert.deepEqual(
    validatePublishProposalV1({ ...proposal, email: "person@example.com" }),
    { ok: false, code: "prohibited_content_field", detail: "email" },
  );
});

test("canonical digests are key-order independent", () => {
  assert.equal(
    digestCanonical({ b: 2, a: 1 }),
    digestCanonical({ a: 1, b: 2 }),
  );
});

test("exchange signals require opaque handles and signed provenance", () => {
  const signal = {
    schema_version: EXCHANGE_CONTRACT_VERSION,
    signal_id: "signal_00000001",
    idempotency_key: "signal_idempotency_01",
    origin_member_id: "member_0000001",
    identifier_type: "verified_email",
    match_handle: "b".repeat(64),
    category: "boundary_testing",
    signal_strength_band: "elevated",
    evidence_tier: "window_available",
    observed_window: proposal.observed_window,
    purpose: "local_investigation",
    policy_ref: "exchange_policy_v1",
    policy_version: "2026-08-08",
    issued_at: "2026-08-08T00:02:00.000Z",
    expires_at: "2026-08-09T00:00:00.000Z",
    provenance_digest: "c".repeat(64),
    authorization_artifact_id: "authz_00000001",
    origin_signature: "d".repeat(64),
    origin_key_id: "member_key_01",
  };
  assert.equal(validateExchangeSignalV1(signal).ok, true);
  assert.equal(
    validateExchangeSignalV1({ ...signal, match_handle: "person@example.com" })
      .ok,
    false,
  );
});

test("private matching accepts only canonical blinded elements and rejects identifiers", () => {
  const request = {
    protocol: PRIVATE_MATCH_PROTOCOL,
    ciphersuite: PRIVATE_MATCH_CIPHERSUITE,
    exchange_id: "exchange_0000001",
    environment: "test",
    key_id: "voprf_key_00001",
    epoch: "2026-08",
    identifier_type: "verified_email",
    purpose: "local_investigation",
    blinded_element: Buffer.alloc(32, 7).toString("base64url"),
  };
  assert.equal(validatePrivateMatchEvaluationRequestV1(request).ok, true);
  assert.deepEqual(
    validatePrivateMatchEvaluationRequestV1({
      ...request,
      identifier: "person@example.com",
    }),
    { ok: false, code: "unexpected_voprf_field", detail: "identifier" },
  );
  assert.equal(
    validatePrivateMatchEvaluationRequestV1({
      ...request,
      blinded_element: "person@example.com",
    }).ok,
    false,
  );
});

test("match lookups stay case-bound, purpose-bound, and time-bound", () => {
  const lookup = {
    schema_version: EXCHANGE_CONTRACT_VERSION,
    lookup_id: "lookup_00000001",
    tenant_id: "tenant_00000001",
    local_subject_ref: "subject_00000001",
    local_case_ref: "case_0000000001",
    identifier_type: "verified_email",
    purpose: "local_investigation",
    requested_at: "2026-08-08T00:02:00.000Z",
    subscription_expires_at: "2026-08-09T00:02:00.000Z",
  };

  assert.equal(validateMatchLookupRequestV1(lookup).ok, true);
  assert.equal(
    validateMatchLookupRequestV1({ ...lookup, purpose: "audit_retention" }).ok,
    false,
  );
  assert.equal(
    validateMatchLookupRequestV1({
      ...lookup,
      subscription_expires_at: lookup.requested_at,
    }).ok,
    false,
  );
});

test("delivery records carry exactly one validated protocol object", () => {
  const signal = {
    schema_version: EXCHANGE_CONTRACT_VERSION,
    signal_id: "signal_00000001",
    idempotency_key: "signal_idempotency_01",
    origin_member_id: "member_0000001",
    identifier_type: "verified_email",
    match_handle: "b".repeat(64),
    category: "boundary_testing",
    signal_strength_band: "elevated",
    evidence_tier: "window_available",
    observed_window: proposal.observed_window,
    purpose: "local_investigation",
    policy_ref: "exchange_policy_v1",
    policy_version: "2026-08-08",
    issued_at: "2026-08-08T00:02:00.000Z",
    expires_at: "2026-08-09T00:00:00.000Z",
    provenance_digest: "c".repeat(64),
    authorization_artifact_id: "authz_00000001",
    origin_signature: "d".repeat(64),
    origin_key_id: "member_key_01",
  };
  const delivery = {
    schema_version: EXCHANGE_CONTRACT_VERSION,
    delivery_id: "delivery_0000001",
    member_id: "member_0000002",
    signal,
    delivered_at: "2026-08-08T00:03:00.000Z",
    broker_signature: "e".repeat(64),
    broker_key_id: "broker_key_0001",
  };

  assert.equal(validateExchangeDeliveryRecordV1(delivery).ok, true);
  assert.equal(
    validateExchangeDeliveryRecordV1({ ...delivery, signal: undefined }).ok,
    false,
  );
  assert.equal(
    validateExchangeDeliveryRecordV1({
      ...delivery,
      revocation: {
        schema_version: EXCHANGE_CONTRACT_VERSION,
        revocation_id: "revocation_00001",
        signal_id: signal.signal_id,
        origin_member_id: signal.origin_member_id,
        reason: "source_invalidated",
        issued_at: "2026-08-08T00:04:00.000Z",
        origin_signature: "f".repeat(64),
        origin_key_id: signal.origin_key_id,
      },
    }).ok,
    false,
  );
});
