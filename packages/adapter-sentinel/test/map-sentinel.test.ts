import assert from "node:assert/strict";
import test from "node:test";

import {
  ROBLOX_SENTINEL_ADAPTER_VERSION,
  ROBLOX_SENTINEL_DETECTOR_ID,
  ROBLOX_SENTINEL_SIGNAL_CATEGORIES,
  mapAffinityScoreToSignalStrength,
  mapRobloxSentinelCandidate,
} from "../src/index.js";

const BASE = Object.freeze({
  candidate_id: "cand_sentinel_secrecy01",
  idempotency_key: "sentinel-secrecy-check-01",
  tenant_id: "tenant_demo_a",
  subject_ref: "subj_actor_sn_0001",
  related_subject_refs: ["subj_peer_sn_0001"],
  conversation_ref: "conv_sn_session_001",
  detector_version: "sentinel_like_v0",
  detector_config_ref: "cfg_sentinel_idx_0001",
  calibration_ref: "cal_sentinel_v0_0001",
  threshold_profile_ref: "thr_sentinel_v0_0001",
  signal_category: "secrecy",
  aggregation_name: "skewness",
  affinity_score: 1.4,
  evidence_ref: "cust_ref_cand_sentinel_secrecy01",
  evidence_tier: "window_available",
  aggregation_window_ref: "win_sn_actor_0001a",
  window_started_at: "2026-08-13T08:00:00.000Z",
  window_ended_at: "2026-08-13T09:00:00.000Z",
  observation_count: 3,
  observed_at: "2026-08-13T09:00:00.000Z",
});

test("valid Sentinel-like candidate maps with signal strength not affinity", () => {
  const mapped = mapRobloxSentinelCandidate(BASE);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;

  assert.equal(mapped.value.detector.detector_id, ROBLOX_SENTINEL_DETECTOR_ID);
  assert.equal(mapped.value.signal.signal_strength_band, "elevated");
  assert.equal(mapped.value.evidence.evidence_tier, "window_available");
  assert.equal(mapped.value.signal.aggregation_name, "skewness");
  assert.equal(mapped.value.category, "secrecy_request");
  assert.equal(JSON.stringify(mapped.value).includes("affinity_score"), false);
  assert.doesNotMatch(JSON.stringify(mapped.value), /message|transcript|chat_log/iu);
});

test("each supported Sentinel category maps to the intended ontology category", () => {
  const expected = {
    secrecy: "secrecy_request",
    threat_or_coercion: "threat_or_coercion",
    boundary_testing: "boundary_testing",
    off_platform_migration: "off_platform_migration",
    sexualization: "sexualization",
    intimate_content_solicitation: "intimate_content_solicitation",
  };

  assert.equal(ROBLOX_SENTINEL_SIGNAL_CATEGORIES.length, 6);
  for (const [category, safetyCategory] of Object.entries(expected)) {
    const mapped = mapRobloxSentinelCandidate({
      ...BASE,
      candidate_id: `cand_sentinel_${category}`.slice(0, 32).padEnd(16, "0"),
      idempotency_key: `sentinel-${category}-check`.slice(0, 32).padEnd(16, "0"),
      evidence_ref: `cust_ref_sentinel_${category}`.slice(0, 40).padEnd(16, "0"),
      signal_category: category,
    });
    assert.equal(mapped.ok, true, category);
    if (!mapped.ok) continue;
    assert.equal(mapped.value.category, safetyCategory);
  }
});

test("unsupported categories, unknown fields, and raw content fail closed", () => {
  assert.equal(mapRobloxSentinelCandidate({ ...BASE, signal_category: "spam" }).ok, false);
  assert.equal(mapRobloxSentinelCandidate({ ...BASE, messages: ["hi"] }).ok, false);
  assert.equal(mapRobloxSentinelCandidate({ ...BASE, unexpected: true }).ok, false);
  assert.equal(mapRobloxSentinelCandidate({ ...BASE, aggregation_stats: {} }).ok, false);
});

test("non-finite percentile fails closed instead of passing NaN through", () => {
  const mapped = mapRobloxSentinelCandidate({ ...BASE, percentile: Number.NaN });
  assert.equal(mapped.ok, false);
  if (!mapped.ok) assert.equal(mapped.code, "invalid_percentile");
});

test("missing calibration/config/threshold provenance fails closed", () => {
  const { calibration_ref: _c, ...withoutCal } = BASE;
  const missing = mapRobloxSentinelCandidate(withoutCal);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "missing_provenance");
});

test("affinity maps to signal_strength_band bands", () => {
  assert.equal(mapAffinityScoreToSignalStrength(1.0), "minimal");
  assert.equal(mapAffinityScoreToSignalStrength(1.2), "elevated");
  assert.equal(mapAffinityScoreToSignalStrength(1.6), "high");
  assert.equal(mapAffinityScoreToSignalStrength(2.1), "severe");
});

test("default detector version uses adapter version when omitted", () => {
  const { detector_version: _v, ...withoutVersion } = BASE;
  const mapped = mapRobloxSentinelCandidate(withoutVersion);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.value.detector.detector_version, ROBLOX_SENTINEL_ADAPTER_VERSION);
});
