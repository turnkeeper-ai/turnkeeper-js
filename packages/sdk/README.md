# `@turnkeeper/sdk`

Server-side TypeScript SDK for Turnkeeper Replay and bounded Control checks.

The package is ESM-only and supports Node.js 22.20 and Node.js 24. Keep project API keys and action
binding secrets in a server-side secret manager.

## Install

Pin the current alpha explicitly because npm's unversioned `latest` channel still resolves to
`0.1.0-alpha.2`:

```sh
npm install @turnkeeper/sdk@0.1.0-alpha.6
```

Use `@turnkeeper/sdk@next` only when intentionally tracking the moving prerelease channel.

## Replay

Replay records metadata-only lifecycle events. Never send prompts, completions, transcripts,
message text, tool arguments or results, PII, credentials, URLs, or arbitrary metadata.

```ts
import {
  REPLAY_API_VERSION,
  TurnkeeperClient,
  parseOpaqueReplayId,
  type ReplayBatch,
} from "@turnkeeper/sdk";

const turnkeeper = new TurnkeeperClient({
  apiKey: process.env.TURNKEEPER_API_KEY!,
  baseUrl: process.env.TURNKEEPER_BASE_URL!,
});

const batch: ReplayBatch = {
  events: [
    {
      api_version: REPLAY_API_VERSION,
      source_event_id: parseOpaqueReplayId("1".repeat(64)),
      type: "turn.decision_recorded",
      occurred_at: new Date().toISOString(),
      conversation_external_id: parseOpaqueReplayId("a".repeat(64)),
      turn_external_id: parseOpaqueReplayId("b".repeat(64)),
      event_index: 0,
      data: { decision_code: "manual_review" },
      privacy: { mode: "metadata_only", key_version: 1 },
    },
  ],
};

// Call from a durable background worker, not the customer-response path.
await turnkeeper.replay.ingestBatch(batch);
```

The Replay client never retries automatically. Persist events in a durable outbox and use
`classifyRetry` to decide whether a failed delivery should be retried or quarantined.

## Control

Treat model tool calls as proposals. Authorization, trusted roles, exact parameter validation,
policy checks, approval state, and execution must remain on the server.

```ts
import {
  ACTION_CONTEXT_SCHEMA_VERSION,
  ControlClient,
  generatePolicy,
  type ActionContext,
} from "@turnkeeper/sdk";

const policy = generatePolicy({
  actionName: "issue_refund",
  allowedRoles: ["support_agent"],
  approvalRequired: true,
  parameterRestrictions: [
    { kind: "required", parameter: "order_id" },
    { kind: "max_number", parameter: "amount", maximum: 500 },
  ],
  requiredConditions: [
    { operator: "gte", signalKey: "amount", value: 100, valueType: "number" },
  ],
  riskLevel: "high",
});

const action: ActionContext = {
  schemaVersion: ACTION_CONTEXT_SCHEMA_VERSION,
  actionName: "issue_refund",
  actorId: authenticatedActor.id,
  actorRoles: authenticatedActor.roles,
  tenantId: authenticatedTenant.id,
  projectId: authenticatedProject.id,
  environment: "production",
  userId: affectedUser.id,
  conversationId: conversation.id,
  turnId: turn.id,
  proposalVersion: 1,
  parameters: validatedProposal,
  signals: { amount: validatedProposal.amount },
};

const control = new ControlClient({
  apiKey: process.env.TURNKEEPER_API_KEY!,
  baseUrl: process.env.TURNKEEPER_BASE_URL!,
});

const result = await control.check(policy, action, {
  bindingSecret: process.env.TURNKEEPER_BINDING_SECRET!,
});

if (result.decision === "block" || result.decision === "review") {
  // Stop. Persist the decision and review reference. Never execute yet.
  return result;
}

// Execute only the exact immutable proposal that produced result.actionBinding.
```

`ControlClient` rejects unmatched hosted decisions, malformed or uncorrelated evidence, request
hash mismatches, and any hosted decision that disagrees with the local policy bundle. It does not
execute tools or resume approvals.

Local validation errors expose safe field diagnostics as `issues: [{ path, code }]` and never
include rejected values. Invalid `TurnkeeperClient` options throw `TurnkeeperValidationError` with
the top-level code `invalid_client_configuration`; invalid Replay inputs retain
`invalid_replay_input`. `GovernanceInputError` uses its operation-specific top-level code and adds
the same sanitized `issues` shape for schema failures.

When a durable worker revisits a paused proposal, retrieve the project-scoped review before doing
anything else:

```ts
const review = await control.getReview(persistedReviewId);

if (review.status === "open") return;
if (review.status !== "approved") return permanentlyStopProposal();

// Reload and revalidate the exact immutable proposal before executing it.
```

The API key requires `reviews:manage`. Review decisions remain human dashboard actions; SDK code
cannot approve its own request.

## Development

From the repository root:

```bash
npm ci
npm run check
```
