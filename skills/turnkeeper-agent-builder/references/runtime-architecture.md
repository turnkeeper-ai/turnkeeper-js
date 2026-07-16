# Runtime architecture

## Required sequence

```text
provider proposes action
  -> parse and validate exact parameters
  -> authorize actor and role
  -> persist the immutable proposal
  -> derive action binding with a server-side secret
  -> derive idempotency key from the binding
  -> evaluate local execution guards
  -> request a hosted decision with ControlClient
  -> allow/audit: execute the exact persisted proposal
  -> review: persist pending state and stop
  -> block/error: stop
  -> record the downstream outcome
  -> enqueue metadata-only Replay events
```

The model never owns authorization, policy authority, approval state, or execution.

## Exact binding

Bind a decision to:

- authenticated actor identity;
- affected user, account, or resource identity;
- conversation and turn identity;
- action name;
- canonical exact parameters;
- policy/check request and idempotency identity.

Represent the proposal with an `ActionContext` containing the action, actor and roles,
conversation, turn, tenant, project, environment, affected subject, proposal version, exact local
parameters, and safe scalar signals.

Persist exact parameters in caller-owned storage. Keep the binding secret in server-side secret
storage. Send only a stable action binding, safe scalar signals, and approved opaque Replay
references to Turnkeeper.

## Approval state

Use explicit states such as `proposed`, `pending_review`, `approved`, `blocked`, `executed`, and
`failed`. An approval must reference the same action binding and expected proposal version.
Changing parameters creates a new proposal and requires a new decision.

## Replay

Replay is metadata-only and asynchronous. Use stable, environment-specific HMAC pseudonyms and a
durable outbox. Never send prompts, completions, transcripts, tool payloads, arbitrary metadata,
PII, URLs, or secrets.
