/**
 * Claim-safe reference adapter for Roblox Sentinel–like detector output.
 *
 * This is NOT an official Roblox product integration, partnership, or endorsement.
 * Turnkeeper does not vendor, install, or execute Sentinel. Customers run detectors
 * in their own environment and emit privacy-minimized window-level candidates only.
 *
 * Sentinel (Apache-2.0) is a high-recall candidate generator. This package contains
 * original Turnkeeper mapping logic only — no Sentinel source was copied.
 */

import { fail, type ValidationResult } from "./result.js";
import type {
  DetectorCandidate,
  DetectorEvidenceTier,
  SafetyCategory,
  SignalStrengthBand,
} from "./types.js";
import { DETECTOR_CANDIDATE_SCHEMA_VERSION, PROHIBITED_CONTENT_FIELDS } from "./types.js";
import { validateDetectorCandidate } from "./validateCandidate.js";

export const ROBLOX_SENTINEL_DETECTOR_ID = "roblox_sentinel";
export const ROBLOX_SENTINEL_DETECTOR_NAME = ROBLOX_SENTINEL_DETECTOR_ID;
export const ROBLOX_SENTINEL_ADAPTER_VERSION = "si_sentinel_ref_v2";

export const ROBLOX_SENTINEL_SIGNAL_CATEGORIES = [
  "secrecy",
  "threat_or_coercion",
  "boundary_testing",
  "off_platform_migration",
  "sexualization",
  "intimate_content_solicitation",
] as const;

export type RobloxSentinelSignalCategory = (typeof ROBLOX_SENTINEL_SIGNAL_CATEGORIES)[number];

const CATEGORY_MAP: Record<RobloxSentinelSignalCategory, SafetyCategory> = {
  secrecy: "secrecy_request",
  threat_or_coercion: "threat_or_coercion",
  boundary_testing: "boundary_testing",
  off_platform_migration: "off_platform_migration",
  sexualization: "sexualization",
  intimate_content_solicitation: "intimate_content_solicitation",
};

const SENTINEL_INPUT_ALLOWED = new Set([
  "candidate_id",
  "idempotency_key",
  "tenant_id",
  "subject_ref",
  "related_subject_refs",
  "conversation_ref",
  "signal_category",
  "detector_version",
  "detector_config_ref",
  "calibration_ref",
  "threshold_profile_ref",
  "detector_run_ref",
  "aggregation_window_ref",
  "window_started_at",
  "window_ended_at",
  "observation_count",
  "aggregation_name",
  "signal_strength_band",
  "evidence_tier",
  "evidence_ref",
  "evidence_snapshot_ref",
  "evidence_manifest_digest",
  "observed_at",
  "received_at",
  "affinity_score",
  "minimum_window_size",
  "top_k",
  "percentile",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reduce a numeric affinity statistic to a customer-calibrated signal strength band.
 * Affinity is not a probability that misconduct occurred.
 */
export function mapAffinityScoreToSignalStrength(score: number): SignalStrengthBand {
  if (!Number.isFinite(score)) return "minimal";
  if (score >= 2.0) return "severe";
  if (score >= 1.5) return "high";
  if (score >= 1.15) return "elevated";
  return "minimal";
}

/** @deprecated Use mapAffinityScoreToSignalStrength — affinity is not confidence. */
export function mapAffinityScoreToBands(score: number): {
  signal_strength_band: SignalStrengthBand;
  evidence_tier: DetectorEvidenceTier;
} {
  return {
    signal_strength_band: mapAffinityScoreToSignalStrength(score),
    evidence_tier: "window_available",
  };
}

/**
 * Map a bounded Sentinel-like window candidate into DetectorCandidate.
 * Fail closed on unsupported categories / missing calibration provenance.
 */
export function mapRobloxSentinelCandidate(raw: unknown): ValidationResult<DetectorCandidate> {
  if (!isRecord(raw)) return fail("invalid_sentinel_candidate", "not_an_object");

  for (const key of Object.keys(raw)) {
    if (PROHIBITED_CONTENT_FIELDS.has(key) && key !== "affinity_score") {
      return fail("prohibited_content_field", key);
    }
    if (!SENTINEL_INPUT_ALLOWED.has(key)) {
      return fail("unexpected_field", key);
    }
  }

  if (
    typeof raw.signal_category !== "string" ||
    !(ROBLOX_SENTINEL_SIGNAL_CATEGORIES as readonly string[]).includes(raw.signal_category)
  ) {
    return fail("unsupported_signal_category", String(raw.signal_category));
  }
  const signal_category = raw.signal_category as RobloxSentinelSignalCategory;
  const category = CATEGORY_MAP[signal_category];

  // Required immutable provenance — missing means reject/quarantine the candidate,
  // never assume danger about a user.
  for (const required of [
    "detector_config_ref",
    "calibration_ref",
    "threshold_profile_ref",
    "aggregation_window_ref",
    "window_started_at",
    "window_ended_at",
    "evidence_ref",
  ] as const) {
    if (typeof raw[required] !== "string" || raw[required].length < 1) {
      return fail("missing_provenance", required);
    }
  }

  let signal_strength_band: SignalStrengthBand | undefined;
  if (typeof raw.signal_strength_band === "string") {
    signal_strength_band = raw.signal_strength_band as SignalStrengthBand;
  }
  if (raw.affinity_score !== undefined) {
    if (typeof raw.affinity_score !== "number") return fail("invalid_affinity_score");
    signal_strength_band =
      signal_strength_band ?? mapAffinityScoreToSignalStrength(raw.affinity_score);
  }
  if (!signal_strength_band) return fail("missing_signal_strength");

  const evidence_tier: DetectorEvidenceTier =
    typeof raw.evidence_tier === "string"
      ? (raw.evidence_tier as DetectorEvidenceTier)
      : "window_available";

  const observed_at =
    typeof raw.observed_at === "string" ? raw.observed_at : String(raw.window_ended_at);
  const received_at = typeof raw.received_at === "string" ? raw.received_at : observed_at;

  const observation_count =
    typeof raw.observation_count === "number" ? raw.observation_count : undefined;
  if (observation_count === undefined) return fail("missing_observation_count");

  const aggregation_parameters: {
    minimum_window_size?: number;
    top_k?: number;
    percentile?: number;
  } = {};
  if (typeof raw.minimum_window_size === "number") {
    aggregation_parameters.minimum_window_size = raw.minimum_window_size;
  }
  if (typeof raw.top_k === "number") aggregation_parameters.top_k = raw.top_k;
  if (raw.percentile !== undefined) {
    if (typeof raw.percentile !== "number" || !Number.isFinite(raw.percentile)) {
      return fail("invalid_percentile");
    }
    aggregation_parameters.percentile = raw.percentile;
  }

  const candidateInput: Record<string, unknown> = {
    schema_version: DETECTOR_CANDIDATE_SCHEMA_VERSION,
    candidate_id: raw.candidate_id,
    idempotency_key: raw.idempotency_key,
    tenant_id: raw.tenant_id,
    subject_ref: raw.subject_ref,
    related_subject_refs: raw.related_subject_refs,
    conversation_ref: raw.conversation_ref,
    category,
    detector: {
      detector_id: ROBLOX_SENTINEL_DETECTOR_ID,
      detector_version:
        typeof raw.detector_version === "string" && raw.detector_version.length > 0
          ? raw.detector_version
          : ROBLOX_SENTINEL_ADAPTER_VERSION,
      detector_config_ref: raw.detector_config_ref,
      calibration_ref: raw.calibration_ref,
      detector_run_ref: raw.detector_run_ref,
    },
    window: {
      aggregation_window_ref: raw.aggregation_window_ref,
      started_at: raw.window_started_at,
      ended_at: raw.window_ended_at,
      observation_count,
    },
    signal: {
      method: "rare_class_affinity",
      aggregation_name:
        typeof raw.aggregation_name === "string" && raw.aggregation_name.length > 0
          ? raw.aggregation_name
          : "skewness",
      signal_strength_band,
      threshold_profile_ref: raw.threshold_profile_ref,
      ...(Object.keys(aggregation_parameters).length > 0 ? { aggregation_parameters } : {}),
    },
    evidence: {
      evidence_ref: raw.evidence_ref,
      evidence_snapshot_ref: raw.evidence_snapshot_ref,
      evidence_manifest_digest: raw.evidence_manifest_digest,
      evidence_tier,
    },
    observed_at,
    received_at,
  };

  return validateDetectorCandidate(candidateInput);
}
