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

Compile-valid sketch. Default `npm run demo` does **not** run this path.

```ts
import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  ControlClient,
  createActionBinding,
  deriveIdempotencyKey,
} from "@turnkeeper/sdk";
import { supportRefundBundle } from "./index.ts";

declare function authenticateActor(req: unknown): {
  actorId: string;
  roles: string[];
  subjectId: string;
};
declare function loadTenantProject(): { tenantId: string; projectId: string; environment: "live" | "test" };
declare function persistExactProposal(proposal: unknown): Promise<{ proposalId: string; proposalVersion: number }>;
declare function deriveTrustedRefundSignals(proposalId: string): Promise<{
  customer_verified: boolean;
  within_refund_window: boolean;
  amount_cents: number;
  prior_refunds_30d: number;
  refund_preflight_complete: boolean;
}>;
declare function persistHeldReview(input: unknown): Promise<void>;
declare function loadImmutableProposal(proposalId: string): Promise<{
  amountCents: number;
  customerRef: string;
  transactionRef: string;
  proposalVersion: number;
}>;
declare function applicationAuthorizesRefund(input: unknown): Promise<boolean>;
declare function callPaymentProvider(input: unknown): Promise<{ providerRef: string }>;
declare function recordDownstreamOutcome(input: unknown): Promise<void>;
declare function enqueueMetadataOnlyReplay(input: unknown): Promise<void>;

const bindingSecret = process.env.TURNKEEPER_BINDING_SECRET!;
const control = new ControlClient({
  apiKey: process.env.TURNKEEPER_API_KEY!,
  baseUrl: process.env.TURNKEEPER_BASE_URL,
});

export async function checkSupportRefund(req: unknown, untrustedProposal: {
  amountCents: number;
  customerRef: string;
  transactionRef: string;
}) {
  // 1. Authenticate the actor.
  const actor = authenticateActor(req);
  // 2. Load tenant/project from trusted server state.
  const scope = loadTenantProject();
  // 3. Validate and persist the exact proposal in application-owned storage.
  const stored = await persistExactProposal(untrustedProposal);
  // 4. Derive trusted refund signals from backend systems (not the model).
  const signals = await deriveTrustedRefundSignals(stored.proposalId);
  // 5. Build the immutable ActionContext and binding.
  const action = {
    actionName: "support.refund" as const,
    actorId: actor.actorId,
    actorRoles: actor.roles,
    conversationId: "conversation_from_trusted_state",
    environment: scope.environment,
    parameters: {
      amount_cents: untrustedProposal.amountCents,
      customer_ref: untrustedProposal.customerRef,
      transaction_ref: untrustedProposal.transactionRef,
    },
    projectId: scope.projectId,
    proposalVersion: stored.proposalVersion,
    schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
    signals,
    tenantId: scope.tenantId,
    turnId: "turn_from_trusted_state",
    userId: actor.subjectId,
  };
  const actionBinding = createActionBinding(action, bindingSecret);
  const idempotencyKey = deriveIdempotencyKey(actionBinding);
  // 6. Call ControlClient.check before any refund side effect.
  const decision = await control.check(supportRefundBundle, action, {
    bindingSecret,
    idempotencyKey,
  });
  // 7. Stop permanently on block or error.
  if (decision.decision === "block") {
    return { applicationState: "permanently_stopped" as const, decision };
  }
  // 8. Persist and pause on review.
  if (decision.decision === "review") {
    await persistHeldReview({
      actionBinding,
      proposalId: stored.proposalId,
      reviewId: decision.reviewId,
    });
    return { applicationState: "held_for_review" as const, decision };
  }
  // audit/allow still require application authorization before execution.
  return { applicationState: "requires_application_authorization" as const, decision };
}

export async function resumeApprovedRefund(input: {
  proposalId: string;
  reviewId: string;
  expectedBinding: string;
}) {
  // 9. Retrieve terminal review state from a durable worker.
  const review = await control.getReview(input.reviewId);
  if (review.status !== "approved") {
    return { applicationState: "permanently_stopped" as const };
  }
  // 10. Reload and revalidate the exact immutable proposal and action binding.
  const proposal = await loadImmutableProposal(input.proposalId);
  const rebound = createActionBinding(
    {
      actionName: "support.refund",
      actorId: "actor_from_trusted_state",
      actorRoles: ["support_agent"],
      conversationId: "conversation_from_trusted_state",
      environment: "live",
      parameters: {
        amount_cents: proposal.amountCents,
        customer_ref: proposal.customerRef,
        transaction_ref: proposal.transactionRef,
      },
      projectId: "project_from_trusted_state",
      proposalVersion: proposal.proposalVersion,
      schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
      signals: await deriveTrustedRefundSignals(input.proposalId),
      tenantId: "tenant_from_trusted_state",
      turnId: "turn_from_trusted_state",
      userId: "subject_from_trusted_state",
    },
    bindingSecret,
  );
  if (rebound !== input.expectedBinding) {
    throw new Error("proposal_binding_mismatch");
  }
  // 11. Application performs its own authorization checks.
  if (!(await applicationAuthorizesRefund(proposal))) {
    return { applicationState: "permanently_stopped" as const };
  }
  // 12. Payment provider call stays in application-owned code.
  const provider = await callPaymentProvider(proposal);
  // 13. Record the downstream outcome locally.
  await recordDownstreamOutcome({ proposalId: input.proposalId, provider });
  // 14. Enqueue metadata-only Replay evidence asynchronously.
  await enqueueMetadataOnlyReplay({
    actionName: "support.refund",
    outcome: "executed",
    proposalId: input.proposalId,
  });
  return { applicationState: "executed_by_application" as const };
}
```

Never send prompts, messages, payment details, PII, or exact refund content to
Replay.

Development tooling after the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.6 inspect .
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.6
```
