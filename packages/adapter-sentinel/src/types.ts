/**
 * Turnkeeper-owned detector candidate contract for claim-safe Sentinel-like mapping.
 * Metadata and opaque refs only — never raw conversation content.
 */

export const DETECTOR_CANDIDATE_SCHEMA_VERSION = "1" as const;

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

/**
 * One detector’s hypothesis about one subject, one category, and one bounded window.
 */
export type DetectorCandidate = {
  schema_version: typeof DETECTOR_CANDIDATE_SCHEMA_VERSION;
  candidate_id: string;
  /** Stable across retries of the same detector run. */
  idempotency_key: string;
  tenant_id: string;
  /** Opaque customer-controlled subject whose activity was aggregated. */
  subject_ref: string;
  /** Optional related peer / conversation subjects (opaque). */
  related_subject_refs?: string[];
  conversation_ref?: string;
  /** Turnkeeper-owned category (not detector-internal taxonomy labels). */
  category: SafetyCategory;
  detector: {
    detector_id: string;
    detector_version: string;
    /** Immutable model/index/aggregator configuration. */
    detector_config_ref: string;
    /** Immutable validation set, thresholds, band mapping, calibration version. */
    calibration_ref: string;
    /** Customer-side runtime log pointer. */
    detector_run_ref?: string;
  };
  window: {
    aggregation_window_ref: string;
    started_at: string;
    ended_at: string;
    observation_count: number;
  };
  signal: {
    /** e.g. rare_class_affinity */
    method: string;
    /** e.g. skewness | top_k_mean | percentile_score */
    aggregation_name: string;
    signal_strength_band: SignalStrengthBand;
    threshold_profile_ref: string;
    /** Tightly bounded optional aggregator parameters — no free-form bags. */
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

export const DETECTOR_CANDIDATE_TOP_KEYS = [
  "schema_version",
  "candidate_id",
  "idempotency_key",
  "tenant_id",
  "subject_ref",
  "related_subject_refs",
  "conversation_ref",
  "category",
  "detector",
  "window",
  "signal",
  "evidence",
  "observed_at",
  "received_at",
] as const;

/**
 * Fields that must never appear on validated detector candidates.
 * `affinity_score` may appear on *input* to the Sentinel mapper only; it is stripped
 * before candidate validation and must not appear on the output.
 */
export const PROHIBITED_CONTENT_FIELDS = new Set([
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
  "affinity_score",
  "rare_class_affinity_score",
  "observation_scores",
  "explanations",
  "embedding",
  "embeddings",
  "aggregation_stats",
  "num_positives",
  "num_negatives",
  "positive_count",
  "negative_count",
  "audio",
  "audio_url",
  "recording",
  "waveform",
]);
