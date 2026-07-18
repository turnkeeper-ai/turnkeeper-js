# Bounded Control checks

`ControlClient` sends a metadata-only policy check to `POST /api/v1/checks`. The hosted API records
the decision and may create a human review, but it never executes the customer action or resumes a
workflow.

The dated request and response contracts are published under
`spec/control-check-request-2026-07-16.schema.json` and
`spec/control-check-response-2026-07-16.schema.json`. The SDK exports the matching
`CONTROL_API_VERSION`.

Project-scoped review retrieval uses
`spec/control-review-response-2026-07-16.schema.json` and the matching
`CONTROL_REVIEW_API_VERSION`.

The hosted response is either a matched policy decision or a fail-closed
`block` with `matched: false`, `policy: null`, and
`reason_code: "no_policy_match"`. `ControlClient` normally resolves that case
locally through the required fallback policy and keeps stricter hosted-policy
correlation for requests that reach the server.

## Required sequence

1. Parse the model output as an untrusted proposal.
2. Authenticate the actor and derive trusted roles, tenant, project, and environment on the server.
3. Validate and persist the exact action parameters in application-owned durable storage.
4. Build an `ActionContext` and derive its keyed action binding.
5. Call `ControlClient.check` before the side effect.
6. Stop on `block` or any error.
7. Persist and pause on `review`.
8. From a durable worker, call `ControlClient.getReview` until the review is terminal.
9. Revalidate the exact immutable proposal and terminal outcome before resuming.
10. Execute only the exact immutable proposal on `allow`, `audit`, or an approved review.
11. Record the downstream outcome and enqueue metadata-only Replay evidence.

## Review completion

`ControlClient.getReview(reviewId)` retrieves one project-scoped review using the same API key. The
key requires the `reviews:manage` scope. Human decisions remain authenticated dashboard actions;
the SDK cannot approve its own request. Keep polling in application-owned durable work rather than
holding a request or process open.

Turnkeeper returns the review status and bounded reason codes. It does not execute, resume, or
reconstruct the customer action. The customer application must load the immutable proposal that
produced the original action binding and revalidate it before any side effect.

## Fail-closed behavior

The SDK rejects:

- an unmatched hosted decision;
- a hosted decision that differs from the validated local policy bundle;
- incomplete check, policy, evidence, or review fields;
- a request-hash mismatch;
- malformed JSON, redirects, oversized responses, timeouts, and transport failures.

These failures do not become authorization.

## Action bindings

`createActionBinding` uses HMAC-SHA-256 with a caller-owned secret. It binds the action name,
authenticated identities, tenant, project, environment, conversation, turn, proposal version,
signals, and exact JSON parameters. It rejects non-JSON objects, accessors, sparse or cyclic
arrays, excessive nesting, and oversized parameters.

Keep the binding secret separate from the Turnkeeper API key and never send or log it.
