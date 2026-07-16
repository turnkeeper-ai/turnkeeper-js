# Framework and provider patterns

## TypeScript and Next.js

- Keep route handlers and server actions thin.
- Parse a proposed tool call into a named server-side domain type.
- Persist the proposal before calling `ControlClient`.
- Execute from persisted data only after `allow`, `audit`, or an explicit approval for the same
  action binding.
- Deliver Replay metadata from a durable worker.

## Node tool-calling agents

Wrap every mutating tool in one checked executor. Read-only tools may run after ordinary
authorization. Mutating tools must pass through proposal, validation, authorization, decision,
execution, and audit stages.

## Python and FastAPI

The public packages are TypeScript packages. For Python, use a typed application-owned HTTP
adapter only when the public API contract supports the required operation. Do not claim that a
Python SDK ships.

## OpenAI-compatible tools

Treat model tool calls as proposals. Parse structured arguments, reject unknown fields, and pass
the proposal into the checked server-side executor. Do not register a provider callback as the
real side-effecting function.

## Anthropic-compatible tools

Treat each `tool_use` block as a proposal. Validate its named input schema, persist it, request a
decision, and return a pending or refused tool result when `review` or `block` prevents execution.

## Provider neutrality

Provider output is advisory data. Do not let provider-specific IDs replace stable application
identity, idempotency, or policy authority.
