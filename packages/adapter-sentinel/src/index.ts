/**
 * @turnkeeper/adapter-sentinel
 *
 * Claim-safe mapping from customer-hosted Sentinel-like window candidates to
 * Turnkeeper DetectorCandidate metadata. Not a Roblox partnership or endorsement.
 */

export type {
  DetectorCandidate,
  DetectorEvidenceTier,
  SafetyCategory,
  SignalStrengthBand,
} from "./types.js";
export {
  DETECTOR_CANDIDATE_SCHEMA_VERSION,
  DETECTOR_EVIDENCE_TIERS,
  PROHIBITED_CONTENT_FIELDS,
  SAFETY_CATEGORIES,
  SIGNAL_STRENGTH_BANDS,
} from "./types.js";

export type { ValidationFailure, ValidationResult, ValidationSuccess } from "./result.js";

export { validateDetectorCandidate } from "./validateCandidate.js";

export {
  ROBLOX_SENTINEL_ADAPTER_VERSION,
  ROBLOX_SENTINEL_DETECTOR_ID,
  ROBLOX_SENTINEL_DETECTOR_NAME,
  ROBLOX_SENTINEL_SIGNAL_CATEGORIES,
  mapAffinityScoreToBands,
  mapAffinityScoreToSignalStrength,
  mapRobloxSentinelCandidate,
  type RobloxSentinelSignalCategory,
} from "./mapSentinel.js";
