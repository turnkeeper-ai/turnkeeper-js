# `@turnkeeper/adapter-sentinel`

Claim-safe TypeScript mapper from **customer-hosted Sentinel-like** window candidates to
Turnkeeper `DetectorCandidate` metadata.

**Not** an official Roblox product, partnership, endorsement, or runtime dependency. Apache-2.0
allows use of Roblox’s open-source [Sentinel](https://github.com/Roblox/Sentinel) library in *your*
environment; it does **not** grant Roblox trademark rights. Do not claim Roblox-equivalent
detection performance.

## What this package does

```text
Your messages (customer environment)
  → Your Sentinel or Sentinel-like detector
  → Window-level candidate (metadata + opaque evidence_ref)
  → mapRobloxSentinelCandidate()
  → DetectorCandidate (privacy-minimized)
  → Your ingest into Turnkeeper Ward / Safety Intelligence
```

Turnkeeper helps organizations **operationalize** open detectors safely. This adapter
**complements** the detector; it does not create a shared intelligence network or informal
cross-tenant child-safety signal database.

## Install

Pre-release — pin an exact version (do not rely on unversioned `latest` until promoted):

```bash
npm install @turnkeeper/adapter-sentinel@0.1.0-alpha.7
```

## Usage

```ts
import { mapRobloxSentinelCandidate } from "@turnkeeper/adapter-sentinel";

const result = mapRobloxSentinelCandidate({
  candidate_id: "cand_sentinel_secrecy01",
  idempotency_key: "sentinel-secrecy-check-01",
  tenant_id: "tenant_demo_a",
  subject_ref: "subj_actor_sn_0001",
  signal_category: "secrecy",
  detector_config_ref: "cfg_sentinel_idx_0001",
  calibration_ref: "cal_sentinel_v0_0001",
  threshold_profile_ref: "thr_sentinel_v0_0001",
  aggregation_window_ref: "win_sn_actor_0001a",
  window_started_at: "2026-08-13T08:00:00.000Z",
  window_ended_at: "2026-08-13T09:00:00.000Z",
  observation_count: 3,
  affinity_score: 1.4,
  evidence_ref: "cust_ref_cand_sentinel_secrecy01",
});

if (!result.ok) {
  // Fail closed — quarantine / fix provenance. Never treat this as user enforcement.
  throw new Error(`${result.code}: ${result.detail ?? ""}`);
}

// result.value is DetectorCandidate metadata only (no raw messages).
```

## Trust boundaries

- Raw chat, neighbor snippets, embeddings, and Sentinel indexes stay in **your** environment.
- Missing `detector_config_ref` / `calibration_ref` / `threshold_profile_ref` (and related
  provenance) **fails closed**.
- `affinity_score` may be supplied as input for band mapping; it is **not** retained on the
  validated candidate.
- This package does not call Roblox APIs, install Sentinel, or execute enforcement.

## Status

Synthetic / reference mapping for design-partner packaging. Live vendor feeds and hosted Ward
ingest remain product concerns of the Turnkeeper platform — not this package.
