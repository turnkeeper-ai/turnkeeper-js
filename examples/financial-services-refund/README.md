# Financial-services refund (`support.refund`)

Synthetic local example for Turnkeeper's Implemented bounded `support.refund`
Control contract. It demonstrates trusted-signal evaluation, fail-closed
behavior, and application-owned revalidation. It does **not** contact a hosted
API, payment provider, or production Control endpoint.

Interactive website companion (also synthetic):
[https://turnkeeper.ai/demo/financial-services](https://turnkeeper.ai/demo/financial-services)

## Status

| Surface | Status |
| --- | --- |
| Public SDK, Control client, local simulation, review retrieval | Implemented |
| Hosted five-template `support.refund` policy library | Implemented |
| Runtime use beyond authorized synthetic/pilot traffic | Gated |
| Automatic execution / approval resumption | Roadmap |

## What Turnkeeper does and does not do

- Turnkeeper does **not** calculate refund eligibility.
- Turnkeeper does **not** verify customer identity.
- Turnkeeper does **not** calculate refund velocity.
- Turnkeeper evaluates trusted metadata supplied by the integrating backend.
- Turnkeeper does **not** store exact refund parameters in Replay.
- Turnkeeper does **not** execute or resume refunds.
- `audit` / `refund_preflight_observed` is observational evidence, not refund
  authorization.
- A human-approved review still requires immutable-proposal revalidation and
  application authorization before any payment-provider call.

## Trusted signals

```ts
type SupportRefundSignals = {
  customer_verified: boolean;
  within_refund_window: boolean;
  amount_cents: number;
  prior_refunds_30d: number;
  refund_preflight_complete: boolean;
};
```

## Local simulation

```sh
TURNKEEPER_BINDING_SECRET=synthetic-demo-only-binding-secret-000001 npm run demo
npm test
npm run typecheck
```

The command uses a public synthetic binding value for local demos only. Real
integrations must load a separate server-side secret of at least 32 bytes from
application secret storage. Simulation is deterministic development behavior,
not hosted authorization.

The local `PolicyBundle` correlates to hosted `support.refund` rule codes,
conditions, decisions, and reason codes. It sets `riskLevel: "medium"` and
`approvalRequired: false` so the SDK validator can retain the hosted `audit`
preflight decision alongside `review` and `block`. It includes an
`always → block` fail-closed fallback (`no_policy_match`). The preflight audit
rule uses a slightly higher local priority so a complete preflight does not lose
to that fallback.

## Scenarios

1. Eligible low-value → `audit` / `refund_preflight_observed`
2. High-value → `review` / `refund_amount_review`
3. Refund-window exception → `review` / `refund_window_exception`
4. Unverified customer → `block` / `customer_not_verified`
5. Repeated refund activity → `review` / `refund_velocity_review`
6. Incomplete preflight → `block` / `no_policy_match`

## Hosted integration pattern (server-side)

Compile-valid helpers live in `src/hostedIntegration.ts` and
`src/actionContextStore.ts`. They:

- validate proposal/signal shapes (positive integer cents, opaque refs, exact
  trusted-signal keys; thresholds stay out of trusted signals)
- build and persist/reload the original `ActionContext`
- call `ControlClient.check` / `getReview` only when wired with credentials
- bind terminal reviews to `review.actionRef` plus rebound action bindings

Default `npm run demo` and `npm test` do **not** perform hosted network calls.
Hosted helpers are exercised with injectable fakes in `test/phase0.test.ts`.

```ts
import {
  assertTerminalReviewBound,
  buildSupportRefundActionContext,
  checkSupportRefund,
  resumeApprovedRefund,
} from "./src/hostedIntegration.ts";
```

Never send prompts, messages, payment details, PII, or exact refund content to
Replay.

Development tooling after the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.7 inspect .
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.7
```
