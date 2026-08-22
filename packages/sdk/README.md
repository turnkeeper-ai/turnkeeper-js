# `@turnkeeper/sdk`

TypeScript contracts and validators for privacy-minimized Turnkeeper Ward safety intelligence.
The package validates structural input locally; it does not make a network call, hold credentials,
create a case, or authorize an action.

## Install

Pin the current alpha explicitly because npm's unversioned `latest` channel still resolves to
`0.1.0-alpha.2`:

```sh
npm install @turnkeeper/sdk@0.2.0-alpha.0
```

Use `@turnkeeper/sdk@next` only when intentionally tracking the moving prerelease channel.

## Validate a detector candidate

```ts
import { validateDetectorCandidateV1 } from "@turnkeeper/sdk";

const result = validateDetectorCandidateV1({
  schema_version: "1",
  candidate_id: "candidate_demo_0001",
  idempotency_key: "candidate_demo_retry_0001",
  tenant_id: "tenant_demo_0001",
  subject_ref: "subject_demo_0001",
  category: "secrecy_request",
  detector: {
    detector_id: "detector_demo",
    detector_version: "2026-08-08",
    detector_config_ref: "config_demo_0001",
    calibration_ref: "calibration_demo_0001",
  },
  window: {
    aggregation_window_ref: "window_demo_0001",
    started_at: "2026-08-08T00:00:00.000Z",
    ended_at: "2026-08-08T00:05:00.000Z",
    observation_count: 2,
  },
  signal: {
    method: "bounded_aggregation",
    aggregation_name: "window_count",
    signal_strength_band: "elevated",
    threshold_profile_ref: "threshold_demo_0001",
  },
  evidence: {
    evidence_ref: "evidence_demo_0001",
    evidence_tier: "signal_only",
  },
  observed_at: "2026-08-08T00:05:00.000Z",
  received_at: "2026-08-08T00:05:01.000Z",
});

if (!result.ok) throw new Error(result.code);
```

Use the validated value only with an approved integration that derives tenant ownership and
authorization from its authenticated server context.

## Exports

- Ward detector-candidate, publish-proposal, exchange-signal, revocation, and delivery validators.
- Private-match protocol types and validators.
- Contract constants including `EXCHANGE_CONTRACT_VERSION`.

The complete wire contract and synthetic fixtures are in the
[Safety Exchange Protocol](../../docs/safety-exchange-protocol-v0.1.md) and
[conformance guide](../../docs/safety-exchange-conformance-v0.1.md).

## Privacy and safety

- Provide opaque customer-controlled references, not raw content or direct identifiers.
- Validators reject prohibited content-shaped keys, unexpected fields, invalid provenance, and
  invalid windows.
- Validation is not an enforcement decision, a hosted API call, or permission to share a signal
  with another organization.

## Development

From the repository root:

```bash
npm ci
npm run check
```
