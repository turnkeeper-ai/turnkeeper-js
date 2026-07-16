# Security checklist

- Route every external write through one checked executor.
- Derive actor, tenant, project, environment, and roles from authenticated server state.
- Validate, persist, and freeze exact parameters before requesting a decision.
- Use explicit `review` or `block` behavior for high-risk actions.
- Give every policy bundle an explicit fallback.
- Reject or safely resolve equal-priority conflicts.
- Keep the action-binding secret in server-side secret storage.
- Reuse the same action binding and idempotency key for an exact retry.
- Never treat `review`, timeout, malformed response, `404`, `429`, or `503` as allow.
- Send Turnkeeper only bounded scalar metadata and opaque references.
- Keep Replay metadata-only, asynchronous, and outside the customer-response path.
- Keep credentials, parameters, customer content, and provider payloads out of logs and errors.
- Test allowed, audited, reviewed, blocked, malformed, unauthorized, parameter-boundary, retry,
  conflict, and bypass cases.
- Keep MCP and CLI local to development; never let them execute real-world actions or print
  secrets.
