import { fail, type ValidationFailure, type ValidationResult } from "./result.js";
import {
  DETECTOR_CANDIDATE_SCHEMA_VERSION,
  DETECTOR_CANDIDATE_TOP_KEYS,
  DETECTOR_EVIDENCE_TIERS,
  PROHIBITED_CONTENT_FIELDS,
  SAFETY_CATEGORIES,
  SIGNAL_STRENGTH_BANDS,
  type DetectorCandidate,
  type SafetyCategory,
} from "./types.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const TENANT_PATTERN = /^[A-Za-z0-9_-]{8,64}$/u;
const EVIDENCE_REF_PATTERN = /^[A-Za-z0-9:_-]{16,256}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return Number.isFinite(Date.parse(value));
}

function rejectProhibitedKeys(
  record: Record<string, unknown>,
  path: string,
): ValidationFailure | null {
  for (const key of Object.keys(record)) {
    if (PROHIBITED_CONTENT_FIELDS.has(key)) {
      return fail("prohibited_content_field", path ? `${path}.${key}` : key);
    }
  }
  return null;
}

/**
 * Strict validation for window-level DetectorCandidate.
 * Fail closed at the detector trust boundary — never treat missing provenance as user danger.
 */
export function validateDetectorCandidate(raw: unknown): ValidationResult<DetectorCandidate> {
  if (!isRecord(raw)) return fail("invalid_candidate", "not_an_object");

  const prohibited = rejectProhibitedKeys(raw, "");
  if (prohibited) return prohibited;

  for (const key of Object.keys(raw)) {
    if (!(DETECTOR_CANDIDATE_TOP_KEYS as readonly string[]).includes(key)) {
      return fail("unexpected_field", key);
    }
  }

  if (raw.schema_version !== DETECTOR_CANDIDATE_SCHEMA_VERSION) {
    return fail("unsupported_schema_version");
  }
  if (typeof raw.candidate_id !== "string" || !ID_PATTERN.test(raw.candidate_id)) {
    return fail("invalid_candidate_id");
  }
  if (typeof raw.idempotency_key !== "string" || !ID_PATTERN.test(raw.idempotency_key)) {
    return fail("invalid_idempotency_key");
  }
  if (typeof raw.tenant_id !== "string" || !TENANT_PATTERN.test(raw.tenant_id)) {
    return fail("invalid_tenant_id");
  }
  if (typeof raw.subject_ref !== "string" || !ID_PATTERN.test(raw.subject_ref)) {
    return fail("invalid_subject_ref");
  }

  const related: string[] = [];
  if (raw.related_subject_refs !== undefined) {
    if (!Array.isArray(raw.related_subject_refs) || raw.related_subject_refs.length > 9) {
      return fail("invalid_related_subject_refs");
    }
    for (const ref of raw.related_subject_refs) {
      if (typeof ref !== "string" || !ID_PATTERN.test(ref)) {
        return fail("invalid_related_subject_ref");
      }
      if (ref === raw.subject_ref || related.includes(ref)) return fail("duplicate_subject_ref");
      related.push(ref);
    }
  }

  if (
    raw.conversation_ref !== undefined &&
    (typeof raw.conversation_ref !== "string" || !ID_PATTERN.test(raw.conversation_ref))
  ) {
    return fail("invalid_conversation_ref");
  }

  if (
    typeof raw.category !== "string" ||
    !(SAFETY_CATEGORIES as readonly string[]).includes(raw.category)
  ) {
    return fail("invalid_category");
  }

  if (!isRecord(raw.detector)) return fail("invalid_detector");
  const detProhibited = rejectProhibitedKeys(raw.detector, "detector");
  if (detProhibited) return detProhibited;
  for (const key of Object.keys(raw.detector)) {
    if (
      ![
        "detector_id",
        "detector_version",
        "detector_config_ref",
        "calibration_ref",
        "detector_run_ref",
      ].includes(key)
    ) {
      return fail("unexpected_field", `detector.${key}`);
    }
  }
  if (typeof raw.detector.detector_id !== "string" || raw.detector.detector_id.length < 1) {
    return fail("missing_detector_id");
  }
  if (
    typeof raw.detector.detector_version !== "string" ||
    raw.detector.detector_version.length < 1
  ) {
    return fail("missing_detector_version");
  }
  if (
    typeof raw.detector.detector_config_ref !== "string" ||
    !ID_PATTERN.test(raw.detector.detector_config_ref)
  ) {
    return fail("missing_detector_config_ref");
  }
  if (
    typeof raw.detector.calibration_ref !== "string" ||
    !ID_PATTERN.test(raw.detector.calibration_ref)
  ) {
    return fail("missing_calibration_ref");
  }
  if (
    raw.detector.detector_run_ref !== undefined &&
    (typeof raw.detector.detector_run_ref !== "string" ||
      !ID_PATTERN.test(raw.detector.detector_run_ref))
  ) {
    return fail("invalid_detector_run_ref");
  }

  if (!isRecord(raw.window)) return fail("invalid_window");
  const winProhibited = rejectProhibitedKeys(raw.window, "window");
  if (winProhibited) return winProhibited;
  for (const key of Object.keys(raw.window)) {
    if (!["aggregation_window_ref", "started_at", "ended_at", "observation_count"].includes(key)) {
      return fail("unexpected_field", `window.${key}`);
    }
  }
  if (
    typeof raw.window.aggregation_window_ref !== "string" ||
    !ID_PATTERN.test(raw.window.aggregation_window_ref)
  ) {
    return fail("invalid_aggregation_window_ref");
  }
  if (!isIsoDate(raw.window.started_at) || !isIsoDate(raw.window.ended_at)) {
    return fail("invalid_window_timestamps");
  }
  if (Date.parse(raw.window.ended_at) < Date.parse(raw.window.started_at)) {
    return fail("invalid_window_order");
  }
  if (
    typeof raw.window.observation_count !== "number" ||
    !Number.isInteger(raw.window.observation_count) ||
    raw.window.observation_count < 1 ||
    raw.window.observation_count > 10_000
  ) {
    return fail("invalid_observation_count");
  }

  if (!isRecord(raw.signal)) return fail("invalid_signal");
  const sigProhibited = rejectProhibitedKeys(raw.signal, "signal");
  if (sigProhibited) return sigProhibited;
  for (const key of Object.keys(raw.signal)) {
    if (
      ![
        "method",
        "aggregation_name",
        "signal_strength_band",
        "threshold_profile_ref",
        "aggregation_parameters",
      ].includes(key)
    ) {
      return fail("unexpected_field", `signal.${key}`);
    }
  }
  if (typeof raw.signal.method !== "string" || raw.signal.method.length < 1) {
    return fail("invalid_signal_method");
  }
  if (typeof raw.signal.aggregation_name !== "string" || raw.signal.aggregation_name.length < 1) {
    return fail("invalid_aggregation_name");
  }
  if (
    typeof raw.signal.signal_strength_band !== "string" ||
    !(SIGNAL_STRENGTH_BANDS as readonly string[]).includes(raw.signal.signal_strength_band)
  ) {
    return fail("invalid_signal_strength_band");
  }
  if (
    typeof raw.signal.threshold_profile_ref !== "string" ||
    !ID_PATTERN.test(raw.signal.threshold_profile_ref)
  ) {
    return fail("missing_threshold_profile_ref");
  }

  let aggregation_parameters: DetectorCandidate["signal"]["aggregation_parameters"];
  if (raw.signal.aggregation_parameters !== undefined) {
    if (!isRecord(raw.signal.aggregation_parameters)) {
      return fail("invalid_aggregation_parameters");
    }
    for (const key of Object.keys(raw.signal.aggregation_parameters)) {
      if (!["minimum_window_size", "top_k", "percentile"].includes(key)) {
        return fail("unexpected_field", `signal.aggregation_parameters.${key}`);
      }
    }
    const params = raw.signal.aggregation_parameters;
    aggregation_parameters = {};
    if (params.minimum_window_size !== undefined) {
      if (
        typeof params.minimum_window_size !== "number" ||
        !Number.isInteger(params.minimum_window_size) ||
        params.minimum_window_size < 1
      ) {
        return fail("invalid_minimum_window_size");
      }
      aggregation_parameters.minimum_window_size = params.minimum_window_size;
    }
    if (params.top_k !== undefined) {
      if (typeof params.top_k !== "number" || !Number.isInteger(params.top_k) || params.top_k < 1) {
        return fail("invalid_top_k");
      }
      aggregation_parameters.top_k = params.top_k;
    }
    if (params.percentile !== undefined) {
      if (
        typeof params.percentile !== "number" ||
        params.percentile < 0 ||
        params.percentile > 100
      ) {
        return fail("invalid_percentile");
      }
      aggregation_parameters.percentile = params.percentile;
    }
  }

  if (!isRecord(raw.evidence)) return fail("invalid_evidence");
  const evProhibited = rejectProhibitedKeys(raw.evidence, "evidence");
  if (evProhibited) return evProhibited;
  for (const key of Object.keys(raw.evidence)) {
    if (
      ![
        "evidence_ref",
        "evidence_snapshot_ref",
        "evidence_manifest_digest",
        "evidence_tier",
      ].includes(key)
    ) {
      return fail("unexpected_field", `evidence.${key}`);
    }
  }
  if (
    typeof raw.evidence.evidence_ref !== "string" ||
    !EVIDENCE_REF_PATTERN.test(raw.evidence.evidence_ref)
  ) {
    return fail("invalid_evidence_ref");
  }
  if (
    raw.evidence.evidence_snapshot_ref !== undefined &&
    (typeof raw.evidence.evidence_snapshot_ref !== "string" ||
      !ID_PATTERN.test(raw.evidence.evidence_snapshot_ref))
  ) {
    return fail("invalid_evidence_snapshot_ref");
  }
  if (
    raw.evidence.evidence_manifest_digest !== undefined &&
    (typeof raw.evidence.evidence_manifest_digest !== "string" ||
      !DIGEST_PATTERN.test(raw.evidence.evidence_manifest_digest))
  ) {
    return fail("invalid_evidence_manifest_digest");
  }
  if (
    typeof raw.evidence.evidence_tier !== "string" ||
    !(DETECTOR_EVIDENCE_TIERS as readonly string[]).includes(raw.evidence.evidence_tier)
  ) {
    return fail("invalid_detector_evidence_tier");
  }

  if (!isIsoDate(raw.observed_at) || !isIsoDate(raw.received_at)) {
    return fail("invalid_timestamps");
  }

  const value: DetectorCandidate = {
    schema_version: DETECTOR_CANDIDATE_SCHEMA_VERSION,
    candidate_id: raw.candidate_id,
    idempotency_key: raw.idempotency_key,
    tenant_id: raw.tenant_id,
    subject_ref: raw.subject_ref,
    category: raw.category as SafetyCategory,
    detector: {
      detector_id: raw.detector.detector_id,
      detector_version: raw.detector.detector_version,
      detector_config_ref: raw.detector.detector_config_ref,
      calibration_ref: raw.detector.calibration_ref,
    },
    window: {
      aggregation_window_ref: raw.window.aggregation_window_ref,
      started_at: raw.window.started_at,
      ended_at: raw.window.ended_at,
      observation_count: raw.window.observation_count,
    },
    signal: {
      method: raw.signal.method,
      aggregation_name: raw.signal.aggregation_name,
      signal_strength_band: raw.signal
        .signal_strength_band as DetectorCandidate["signal"]["signal_strength_band"],
      threshold_profile_ref: raw.signal.threshold_profile_ref,
    },
    evidence: {
      evidence_ref: raw.evidence.evidence_ref,
      evidence_tier: raw.evidence.evidence_tier as DetectorCandidate["evidence"]["evidence_tier"],
    },
    observed_at: raw.observed_at,
    received_at: raw.received_at,
  };

  if (related.length > 0) value.related_subject_refs = related;
  if (typeof raw.conversation_ref === "string") value.conversation_ref = raw.conversation_ref;
  if (typeof raw.detector.detector_run_ref === "string") {
    value.detector.detector_run_ref = raw.detector.detector_run_ref;
  }
  if (aggregation_parameters !== undefined) {
    value.signal.aggregation_parameters = aggregation_parameters;
  }
  if (typeof raw.evidence.evidence_snapshot_ref === "string") {
    value.evidence.evidence_snapshot_ref = raw.evidence.evidence_snapshot_ref;
  }
  if (typeof raw.evidence.evidence_manifest_digest === "string") {
    value.evidence.evidence_manifest_digest = raw.evidence.evidence_manifest_digest;
  }

  return { ok: true, value };
}
