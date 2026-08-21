# Synthetic examples

This directory contains synthetic integrations and architecture patterns. Runnable examples use
local simulations or fake providers by default; they do not authorize or execute production
actions. A passing example test demonstrates the repository contract only, not approval for a
real-world action.

Run commands from the repository root after `npm ci`. The focused commands below verify one
example at a time; `npm run check` remains the full repository check.

| Example | Scenario | Public surface | Status | Focused verification |
| --- | --- | --- | --- | --- |
| [`account-contact-change`](account-contact-change/README.md) | Change an account contact channel without exposing customer free text | SDK `simulateAction`; bounded `account.contact_information.change` Control contract | Runnable local simulation | `npm run test --workspace @turnkeeper/example-account-contact-change` |
| [`account-management-agent`](account-management-agent/README.md) | Evaluate profile updates, account cancellation, and payment-reference changes | SDK `simulateAction`; local Control decisions with stable action binding | Runnable local simulation | `npm run test --workspace @turnkeeper/example-account-management-agent` |
| [`appointment-create`](appointment-create/README.md) | Persist, review, revalidate, and reconcile an appointment proposal | Appointment `ActionContext` helpers; local Control simulation; fake calendar provider | Runnable customer-side loop | `npm run test --workspace @turnkeeper/example-appointment-create` |
| [`booking-agent`](booking-agent/README.md) | Keep availability lookup read-only and gate booking confirmation | SDK `simulateAction`; review-gated booking Control proposal | Runnable local simulation | `npm run test --workspace @turnkeeper/example-booking-agent` |
| [`customer-support-agent`](customer-support-agent/README.md) | Evaluate a bounded refund proposal without executing a refund | SDK `simulateAction`; `support.refund` Control proposal and exact action binding | Runnable local simulation | `npm run test --workspace @turnkeeper/example-customer-support-agent` |
| [`durable-outbox-worker`](durable-outbox-worker/README.md) | Deliver metadata-only Replay batches from a crash-recoverable outbox | Replay `ingestBatch` delivery architecture | Documentation-only; no package script | Repository check: `npm run check` |
| [`financial-services-refund`](financial-services-refund/README.md) | Evaluate and resume a synthetic refund with application-owned state | Local Control simulation; injectable `ControlClient`; review retrieval; metadata-only Replay handoff | Runnable offline by default | `npm run test --workspace @turnkeeper/example-financial-services-refund` |
| [`self-hosted-safeguard`](self-hosted-safeguard/README.md) | Map a validated self-hosted safeguard result into bounded safety metadata | `model.output.safety` Control signals and a metadata-only Replay lifecycle | Runnable offline by default | `npm run test --workspace @turnkeeper/example-self-hosted-safeguard` |
| [`support-escalation`](support-escalation/README.md) | Evaluate a bounded support escalation proposal | SDK `simulateAction`; `support.escalation` Control contract | Runnable local simulation | `npm run test --workspace @turnkeeper/example-support-escalation` |

All fixtures, identifiers, binding values, and providers in these examples are synthetic. Read each
example README before running its demo command; some examples require a documented synthetic
binding value.

## Related package awaiting an example

`@turnkeeper/adapter-sentinel` does not yet have a synthetic directory under `examples/`. Until
that example exists, start with the [package README](../packages/adapter-sentinel/README.md) and
the [claim-safe mapper test](../packages/adapter-sentinel/test/map-sentinel.test.ts). The package
maps a validated Sentinel-like candidate into bounded `DetectorCandidate` metadata; it is not a
Control or Replay workflow and does not establish a live provider integration.

Verify the current package with:

```bash
npm run test --workspace @turnkeeper/adapter-sentinel
```
