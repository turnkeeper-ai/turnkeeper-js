/**
 * Privacy-minimized Safety Intelligence exchange contracts.
 *
 * These contracts intentionally carry opaque references and bounded metadata
 * only. Raw content and direct identifiers are prohibited at this boundary.
 */

import { createHash } from "node:crypto";

export const EXCHANGE_CONTRACT_VERSION = "2026-08-08" as const;

export const SAFETY_CATEGORIES = [
  "secrecy_request",
  "threat_or_coercion",
  "boundary_testing",
  "off_platform_migration",
  "sexualization",
  "intimate_content_solicitation",
] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const SIGNAL_STRENGTH_BANDS = ["minimal", "elevated", "high", "severe"] as const;
export type SignalStrengthBand = (typeof SIGNAL_STRENGTH_BANDS)[number];

export const DETECTOR_EVIDENCE_TIERS = [
  "signal_only",
  "window_available",
  "corroborated",
  "reviewed",
] as const;
export type DetectorEvidenceTier = (typeof DETECTOR_EVIDENCE_TIERS)[number];

export const EXCHANGE_PURPOSES = [
  "local_investigation",
  "specialist_review",
  "audit_retention",
] as const;
export type ExchangePurpose = (typeof EXCHANGE_PURPOSES)[number];

export const FORBIDDEN_EXCHANGE_PURPOSES = [
  "model_training",
  "global_reputation",
  "automated_enforcement",
  "parent_notification",
  "bulk_screening",
] as const;

export const IDENTIFIER_TYPES = ["verified_email", "verified_phone"] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

export type DetectorCandidateV1 = {
  schema_version: "1";
  candidate_id: string;
  idempotency_key: string;
  tenant_id: string;
  subject_ref: string;
  related_subject_refs?: string[];
  conversation_ref?: string;
  category: SafetyCategory;
  detector: {
    detector_id: string;
    detector_version: string;
    detector_config_ref: string;
    calibration_ref: string;
    detector_run_ref?: string;
  };
  window: {
    aggregation_window_ref: string;
    started_at: string;
    ended_at: string;
    observation_count: number;
  };
  signal: {
    method: string;
    aggregation_name: string;
    signal_strength_band: SignalStrengthBand;
    threshold_profile_ref: string;
    aggregation_parameters?: {
      minimum_window_size?: number;
      top_k?: number;
      percentile?: number;
    };
  };
  evidence: {
    evidence_ref: string;
    evidence_snapshot_ref?: string;
    evidence_manifest_digest?: string;
    evidence_tier: DetectorEvidenceTier;
  };
  observed_at: string;
  received_at: string;
};

export type PublishProposalV1 = {
  schema_version: typeof EXCHANGE_CONTRACT_VERSION;
  proposal_id: string;
  idempotency_key: string;
  tenant_id: string;
  candidate_id: string;
  subject_ref: string;
  identifier_type: IdentifierType;
  identifier_commitment: string;
  category: SafetyCategory;
  signal_strength_band: SignalStrengthBand;
  evidence_tier: DetectorEvidenceTier;
  evidence_snapshot_digest?: string;
  observed_window: { started_at: string; ended_at: string };
  purpose: ExchangePurpose;
  expires_at: string;
  policy_ref: string;
  policy_version: string;
  created_at: string;
};

export type ExchangeSignalEnvelopeV1 = {
  schema_version: typeof EXCHANGE_CONTRACT_VERSION;
  signal_id: string;
  idempotency_key: string;
  origin_member_id: string;
  identifier_type: IdentifierType;
  match_handle: string;
  category: SafetyCategory;
  signal_strength_band: SignalStrengthBand;
  evidence_tier: DetectorEvidenceTier;
  evidence_snapshot_digest?: string;
  observed_window: { started_at: string; ended_at: string };
  purpose: ExchangePurpose;
  policy_ref: string;
  policy_version: string;
  issued_at: string;
  expires_at: string;
  provenance_digest: string;
  authorization_artifact_id: string;
  origin_signature: string;
  origin_key_id: string;
};

export type ExchangeRevocationV1 = {
  schema_version: typeof EXCHANGE_CONTRACT_VERSION;
  revocation_id: string;
  signal_id: string;
  origin_member_id: string;
  reason: "source_invalidated" | "retention_expired" | "member_paused" | "policy_withdrawn";
  issued_at: string;
  origin_signature: string;
  origin_key_id: string;
};

export type MatchLookupRequestV1 = {
  schema_version: typeof EXCHANGE_CONTRACT_VERSION;
  lookup_id: string;
  tenant_id: string;
  local_subject_ref: string;
  local_case_ref: string;
  identifier_type: IdentifierType;
  purpose: Extract<ExchangePurpose, "local_investigation" | "specialist_review">;
  requested_at: string;
  subscription_expires_at: string;
};

export type ExchangeDeliveryRecordV1 = {
  schema_version: typeof EXCHANGE_CONTRACT_VERSION;
  delivery_id: string;
  member_id: string;
  signal?: ExchangeSignalEnvelopeV1;
  revocation?: ExchangeRevocationV1;
  delivered_at: string;
  broker_signature: string;
  broker_key_id: string;
};

export const PROHIBITED_EXCHANGE_KEYS = new Set([
  "text",
  "message",
  "messages",
  "content",
  "body",
  "prompt",
  "completion",
  "transcript",
  "chat",
  "chat_log",
  "raw",
  "raw_payload",
  "attachment",
  "attachments",
  "url",
  "urls",
  "username",
  "email",
  "phone",
  "display_name",
  "identifier",
  "affinity_score",
  "observation_scores",
  "explanations",
  "embedding",
  "embeddings",
]);

export type ExchangeValidationFailure = { ok: false; code: string; detail?: string };
export type ExchangeValidationSuccess<T> = { ok: true; value: T };
export type ExchangeValidationResult<T> =
  | ExchangeValidationFailure
  | ExchangeValidationSuccess<T>;

const ID = /^[A-Za-z0-9_-]{8,128}$/u;
const REF = /^[A-Za-z0-9:_/-]{8,256}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const SIGNATURE = /^[A-Za-z0-9_-]{32,512}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function date(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function fail(code: string, detail?: string): ExchangeValidationFailure {
  return detail ? { ok: false, code, detail } : { ok: false, code };
}

function rejectKeys(value: Record<string, unknown>, path: string): ExchangeValidationFailure | null {
  for (const key of Object.keys(value)) {
    if (PROHIBITED_EXCHANGE_KEYS.has(key)) return fail("prohibited_content_field", `${path}${key}`);
  }
  return null;
}

function rejectDeep(value: unknown, path = "", seen = new Set<object>()): ExchangeValidationFailure | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return fail("cyclic_value", path);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const failure = rejectDeep(item, `${path}[${index}].`, seen);
        if (failure) return failure;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    const prohibited = rejectKeys(record, path);
    if (prohibited) return prohibited;
    for (const [key, item] of Object.entries(record)) {
      const failure = rejectDeep(item, `${path}${key}.`, seen);
      if (failure) return failure;
    }
    return null;
  } finally {
    seen.delete(value);
  }
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: readonly string[], path = ""): ExchangeValidationFailure | null {
  for (const key of Object.keys(record)) if (!allowed.includes(key)) return fail("unexpected_field", `${path}${key}`);
  return null;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  values: T,
  code: string,
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function validateDetectorCandidateV1(
  raw: unknown,
): ExchangeValidationResult<DetectorCandidateV1> {
  if (!isRecord(raw)) return fail("invalid_candidate", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, ["schema_version", "candidate_id", "idempotency_key", "tenant_id", "subject_ref", "related_subject_refs", "conversation_ref", "category", "detector", "window", "signal", "evidence", "observed_at", "received_at"]);
  if (unknown) return unknown;
  if (raw.schema_version !== "1") return fail("unsupported_schema_version");
  if (typeof raw.candidate_id !== "string" || !ID.test(raw.candidate_id)) return fail("invalid_candidate_id");
  if (typeof raw.idempotency_key !== "string" || !ID.test(raw.idempotency_key)) return fail("invalid_idempotency_key");
  if (typeof raw.tenant_id !== "string" || !ID.test(raw.tenant_id)) return fail("invalid_tenant_id");
  if (typeof raw.subject_ref !== "string" || !ID.test(raw.subject_ref)) return fail("invalid_subject_ref");
  if (!enumValue(raw.category, SAFETY_CATEGORIES, "invalid_category")) return fail("invalid_category");
  if (!isRecord(raw.detector) || !isRecord(raw.window) || !isRecord(raw.signal) || !isRecord(raw.evidence)) {
    return fail("invalid_candidate_shape");
  }
  for (const [value, allowed, path] of [
    [raw.detector, ["detector_id", "detector_version", "detector_config_ref", "calibration_ref", "detector_run_ref"], "detector."],
    [raw.window, ["aggregation_window_ref", "started_at", "ended_at", "observation_count"], "window."],
    [raw.signal, ["method", "aggregation_name", "signal_strength_band", "threshold_profile_ref", "aggregation_parameters"], "signal."],
    [raw.evidence, ["evidence_ref", "evidence_snapshot_ref", "evidence_manifest_digest", "evidence_tier"], "evidence."],
  ] as const) {
    const failure = rejectUnknownKeys(value, allowed, path);
    if (failure) return failure;
  }
  if (
    typeof raw.detector.detector_id !== "string" ||
    typeof raw.detector.detector_version !== "string" ||
    typeof raw.detector.detector_config_ref !== "string" ||
    !ID.test(raw.detector.detector_config_ref) ||
    typeof raw.detector.calibration_ref !== "string" ||
    !ID.test(raw.detector.calibration_ref)
  ) return fail("invalid_detector");
  if (
    typeof raw.window.aggregation_window_ref !== "string" ||
    !ID.test(raw.window.aggregation_window_ref) ||
    !date(raw.window.started_at) ||
    !date(raw.window.ended_at) ||
    Date.parse(raw.window.ended_at) < Date.parse(raw.window.started_at) ||
    typeof raw.window.observation_count !== "number" ||
    !Number.isInteger(raw.window.observation_count) ||
    raw.window.observation_count < 1 ||
    raw.window.observation_count > 10_000
  ) return fail("invalid_window");
  if (
    typeof raw.signal.method !== "string" ||
    typeof raw.signal.aggregation_name !== "string" ||
    !enumValue(raw.signal.signal_strength_band, SIGNAL_STRENGTH_BANDS, "invalid_signal_strength_band") ||
    typeof raw.signal.threshold_profile_ref !== "string" ||
    !ID.test(raw.signal.threshold_profile_ref)
  ) return fail("invalid_signal");
  if (
    typeof raw.evidence.evidence_ref !== "string" ||
    !REF.test(raw.evidence.evidence_ref) ||
    !enumValue(raw.evidence.evidence_tier, DETECTOR_EVIDENCE_TIERS, "invalid_evidence_tier")
  ) return fail("invalid_evidence");
  if (!date(raw.observed_at) || !date(raw.received_at)) return fail("invalid_timestamps");

  return { ok: true, value: raw as DetectorCandidateV1 };
}

export function validatePublishProposalV1(
  raw: unknown,
): ExchangeValidationResult<PublishProposalV1> {
  if (!isRecord(raw)) return fail("invalid_proposal", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, ["schema_version", "proposal_id", "idempotency_key", "tenant_id", "candidate_id", "subject_ref", "identifier_type", "identifier_commitment", "category", "signal_strength_band", "evidence_tier", "evidence_snapshot_digest", "observed_window", "purpose", "expires_at", "policy_ref", "policy_version", "created_at"]);
  if (unknown) return unknown;
  if (raw.schema_version !== EXCHANGE_CONTRACT_VERSION) return fail("unsupported_schema_version");
  if (typeof raw.proposal_id !== "string" || !ID.test(raw.proposal_id)) return fail("invalid_proposal_id");
  if (typeof raw.idempotency_key !== "string" || !ID.test(raw.idempotency_key)) return fail("invalid_idempotency_key");
  if (typeof raw.tenant_id !== "string" || !ID.test(raw.tenant_id)) return fail("invalid_tenant_id");
  if (typeof raw.candidate_id !== "string" || !ID.test(raw.candidate_id)) return fail("invalid_candidate_id");
  if (typeof raw.subject_ref !== "string" || !ID.test(raw.subject_ref)) return fail("invalid_subject_ref");
  if (!enumValue(raw.identifier_type, IDENTIFIER_TYPES, "invalid_identifier_type")) return fail("invalid_identifier_type");
  if (typeof raw.identifier_commitment !== "string" || !DIGEST.test(raw.identifier_commitment)) return fail("invalid_identifier_commitment");
  if (!enumValue(raw.category, SAFETY_CATEGORIES, "invalid_category")) return fail("invalid_category");
  if (!enumValue(raw.signal_strength_band, SIGNAL_STRENGTH_BANDS, "invalid_signal_strength_band")) return fail("invalid_signal_strength_band");
  if (!enumValue(raw.evidence_tier, DETECTOR_EVIDENCE_TIERS, "invalid_evidence_tier")) return fail("invalid_evidence_tier");
  if (!enumValue(raw.purpose, EXCHANGE_PURPOSES, "invalid_purpose")) return fail("invalid_purpose");
  if (typeof raw.policy_ref !== "string" || !REF.test(raw.policy_ref) || typeof raw.policy_version !== "string" || !REF.test(raw.policy_version)) return fail("invalid_policy");
  if (!date(raw.created_at) || !date(raw.expires_at) || Date.parse(raw.expires_at) <= Date.parse(raw.created_at)) return fail("invalid_expiry");
  if (!isRecord(raw.observed_window) || !date(raw.observed_window.started_at) || !date(raw.observed_window.ended_at) || Date.parse(raw.observed_window.ended_at) < Date.parse(raw.observed_window.started_at)) return fail("invalid_observed_window");
  const proposalWindowUnknown = isRecord(raw.observed_window) ? rejectUnknownKeys(raw.observed_window, ["started_at", "ended_at"], "observed_window.") : null;
  if (proposalWindowUnknown) return proposalWindowUnknown;
  if (raw.evidence_snapshot_digest !== undefined && (typeof raw.evidence_snapshot_digest !== "string" || !DIGEST.test(raw.evidence_snapshot_digest))) return fail("invalid_evidence_snapshot_digest");
  return { ok: true, value: raw as PublishProposalV1 };
}

export function validateExchangeSignalV1(
  raw: unknown,
): ExchangeValidationResult<ExchangeSignalEnvelopeV1> {
  if (!isRecord(raw)) return fail("invalid_exchange_signal", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, ["schema_version", "signal_id", "idempotency_key", "origin_member_id", "identifier_type", "match_handle", "category", "signal_strength_band", "evidence_tier", "evidence_snapshot_digest", "observed_window", "purpose", "policy_ref", "policy_version", "issued_at", "expires_at", "provenance_digest", "authorization_artifact_id", "origin_signature", "origin_key_id"]);
  if (unknown) return unknown;
  if (raw.schema_version !== EXCHANGE_CONTRACT_VERSION) return fail("unsupported_schema_version");
  for (const key of ["signal_id", "idempotency_key", "origin_member_id", "authorization_artifact_id", "origin_key_id"] as const) {
    if (typeof raw[key] !== "string" || !ID.test(raw[key])) return fail(`invalid_${key}`);
  }
  if (!enumValue(raw.identifier_type, IDENTIFIER_TYPES, "invalid_identifier_type")) return fail("invalid_identifier_type");
  if (typeof raw.match_handle !== "string" || !DIGEST.test(raw.match_handle)) return fail("invalid_match_handle");
  if (!enumValue(raw.category, SAFETY_CATEGORIES, "invalid_category") || !enumValue(raw.signal_strength_band, SIGNAL_STRENGTH_BANDS, "invalid_signal_strength_band") || !enumValue(raw.evidence_tier, DETECTOR_EVIDENCE_TIERS, "invalid_evidence_tier") || !enumValue(raw.purpose, EXCHANGE_PURPOSES, "invalid_purpose")) return fail("invalid_signal_metadata");
  if (typeof raw.policy_ref !== "string" || !REF.test(raw.policy_ref) || typeof raw.policy_version !== "string" || !REF.test(raw.policy_version)) return fail("invalid_policy");
  if (typeof raw.provenance_digest !== "string" || !DIGEST.test(raw.provenance_digest) || typeof raw.origin_signature !== "string" || !SIGNATURE.test(raw.origin_signature)) return fail("invalid_provenance_or_signature");
  if (!date(raw.issued_at) || !date(raw.expires_at) || Date.parse(raw.expires_at) <= Date.parse(raw.issued_at)) return fail("invalid_expiry");
  if (!isRecord(raw.observed_window) || !date(raw.observed_window.started_at) || !date(raw.observed_window.ended_at) || Date.parse(raw.observed_window.ended_at) < Date.parse(raw.observed_window.started_at)) return fail("invalid_observed_window");
  const signalWindowUnknown = isRecord(raw.observed_window) ? rejectUnknownKeys(raw.observed_window, ["started_at", "ended_at"], "observed_window.") : null;
  if (signalWindowUnknown) return signalWindowUnknown;
  if (raw.evidence_snapshot_digest !== undefined && (typeof raw.evidence_snapshot_digest !== "string" || !DIGEST.test(raw.evidence_snapshot_digest))) return fail("invalid_evidence_snapshot_digest");
  return { ok: true, value: raw as ExchangeSignalEnvelopeV1 };
}

export function validateExchangeRevocationV1(
  raw: unknown,
): ExchangeValidationResult<ExchangeRevocationV1> {
  if (!isRecord(raw)) return fail("invalid_revocation", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, ["schema_version", "revocation_id", "signal_id", "origin_member_id", "reason", "issued_at", "origin_signature", "origin_key_id"]);
  if (unknown) return unknown;
  if (raw.schema_version !== EXCHANGE_CONTRACT_VERSION) return fail("unsupported_schema_version");
  for (const key of ["revocation_id", "signal_id", "origin_member_id", "origin_key_id"] as const) {
    if (typeof raw[key] !== "string" || !ID.test(raw[key])) return fail(`invalid_${key}`);
  }
  if (!enumValue(raw.reason, ["source_invalidated", "retention_expired", "member_paused", "policy_withdrawn"] as const, "invalid_reason")) return fail("invalid_reason");
  if (!date(raw.issued_at) || typeof raw.origin_signature !== "string" || !SIGNATURE.test(raw.origin_signature)) return fail("invalid_revocation_signature");
  return { ok: true, value: raw as ExchangeRevocationV1 };
}

export function validateMatchLookupRequestV1(
  raw: unknown,
): ExchangeValidationResult<MatchLookupRequestV1> {
  if (!isRecord(raw)) return fail("invalid_match_lookup", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, [
    "schema_version",
    "lookup_id",
    "tenant_id",
    "local_subject_ref",
    "local_case_ref",
    "identifier_type",
    "purpose",
    "requested_at",
    "subscription_expires_at",
  ]);
  if (unknown) return unknown;
  if (raw.schema_version !== EXCHANGE_CONTRACT_VERSION)
    return fail("unsupported_schema_version");
  for (const key of [
    "lookup_id",
    "tenant_id",
    "local_subject_ref",
    "local_case_ref",
  ] as const) {
    if (typeof raw[key] !== "string" || !ID.test(raw[key]))
      return fail(`invalid_${key}`);
  }
  if (!enumValue(raw.identifier_type, IDENTIFIER_TYPES, "invalid_identifier_type"))
    return fail("invalid_identifier_type");
  if (
    !enumValue(
      raw.purpose,
      ["local_investigation", "specialist_review"] as const,
      "invalid_purpose",
    )
  )
    return fail("invalid_purpose");
  if (
    !date(raw.requested_at) ||
    !date(raw.subscription_expires_at) ||
    Date.parse(raw.subscription_expires_at) <= Date.parse(raw.requested_at)
  )
    return fail("invalid_subscription_expiry");
  return { ok: true, value: raw as MatchLookupRequestV1 };
}

export function validateExchangeDeliveryRecordV1(
  raw: unknown,
): ExchangeValidationResult<ExchangeDeliveryRecordV1> {
  if (!isRecord(raw)) return fail("invalid_delivery", "not_an_object");
  const prohibited = rejectDeep(raw);
  if (prohibited) return prohibited;
  const unknown = rejectUnknownKeys(raw, [
    "schema_version",
    "delivery_id",
    "member_id",
    "signal",
    "revocation",
    "delivered_at",
    "broker_signature",
    "broker_key_id",
  ]);
  if (unknown) return unknown;
  if (raw.schema_version !== EXCHANGE_CONTRACT_VERSION)
    return fail("unsupported_schema_version");
  for (const key of ["delivery_id", "member_id", "broker_key_id"] as const) {
    if (typeof raw[key] !== "string" || !ID.test(raw[key]))
      return fail(`invalid_${key}`);
  }
  if (
    !date(raw.delivered_at) ||
    typeof raw.broker_signature !== "string" ||
    !SIGNATURE.test(raw.broker_signature)
  )
    return fail("invalid_delivery_signature");
  const carriesSignal = raw.signal !== undefined;
  const carriesRevocation = raw.revocation !== undefined;
  if (carriesSignal === carriesRevocation)
    return fail("invalid_delivery_payload", "expected_exactly_one_protocol_object");
  if (carriesSignal) {
    const signal = validateExchangeSignalV1(raw.signal);
    if (!signal.ok) return fail("invalid_delivery_signal", `${signal.code}: ${signal.detail ?? ""}`);
  }
  if (carriesRevocation) {
    const revocation = validateExchangeRevocationV1(raw.revocation);
    if (!revocation.ok)
      return fail(
        "invalid_delivery_revocation",
        `${revocation.code}: ${revocation.detail ?? ""}`,
      );
  }
  return { ok: true, value: raw as ExchangeDeliveryRecordV1 };
}

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non_json_number");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") throw new TypeError("non_json_value");
  if (seen.has(value)) throw new TypeError("cyclic_value");
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item, seen)).join(",")}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], seen)}`).join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function stableCanonicalJson(value: unknown): string {
  return canonicalize(value, new Set());
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function digestCanonical(value: unknown): string {
  return sha256Hex(stableCanonicalJson(value));
}
