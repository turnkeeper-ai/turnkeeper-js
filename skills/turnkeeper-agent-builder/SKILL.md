---
name: turnkeeper-agent-builder
description: Build, migrate, review, or test TypeScript AI agents that use the public Turnkeeper SDK, CLI, and MCP packages for policy checks, human-review pauses, safe tool execution, and metadata-only Replay evidence. Use when adding Turnkeeper to a tool-calling agent, defining high-risk actions and policies, scaffolding an integration, or checking an agent for authorization bypasses, mutable approved parameters, unsafe metadata, missing idempotency, or missing audit delivery.
---

# Turnkeeper Agent Builder

Build against the public packages:

- `@turnkeeper/sdk` for runtime policy helpers, Control checks, and metadata-only Replay delivery.
- `@turnkeeper/cli` for deterministic scaffolding, validation, and generated policy cases.
- `@turnkeeper/mcp` for development-time guidance and code-generation tools.

Treat all `0.1.0-alpha.2` surfaces as prerelease. Do not claim that Turnkeeper executes customer
actions, automatically resumes approved work, or replaces application authorization.

## Workflow

1. Inventory every external side effect. Separate reads from writes and irreversible actions.
2. Define one typed proposal containing the exact actor, affected subject, conversation, action,
   and parameters.
3. Validate authorization and parameters on the server, then persist the exact proposal in
   caller-owned durable storage.
4. Derive a stable action binding with a server-side binding secret, then derive the idempotency
   key from that binding.
5. Generate and validate an explicit policy. Use `review` or `block` for high-risk actions and
   include an explicit fallback.
6. Use `simulateAction` only for local development and tests.
7. In a live integration, call `ControlClient` before the real tool. Stop on `block`, persist and
   pause on `review`, and execute only the exact approved proposal on `allow` or `audit`.
8. Record the downstream result locally. Deliver metadata-only Replay events from a durable
   background worker outside the customer-response path.
9. Test allow, audit, review, block, malformed input, unauthorized roles, parameter restrictions,
   exact retries, conflicts, unavailable checks, and bypass attempts.

Read [references/runtime-architecture.md](references/runtime-architecture.md) before changing a
runtime path. Read [references/public-packages.md](references/public-packages.md) when choosing a
package or command. Read [references/framework-patterns.md](references/framework-patterns.md) for
framework-specific placement. Read
[references/security-checklist.md](references/security-checklist.md) before handoff.

## Use the public tooling

After the alpha packages are published:

```sh
npx @turnkeeper/cli@0.1.0-alpha.2 init ./my-agent
npx @turnkeeper/cli@0.1.0-alpha.2 validate ./my-agent/turnkeeper/policies.json
npx @turnkeeper/cli@0.1.0-alpha.2 test-policies ./my-agent/turnkeeper/policies.json
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.2
```

When working in this repository before publication, build and run the matching npm workspaces.

Use MCP for quickstarts, examples, scaffolds, policy generation, validation, simulation, tests,
integration inspection, and migration guidance. Treat every MCP result as development-time
guidance. MCP and local simulation never authorize a production action.

## Required architecture

- Keep model/provider output advisory. A model may propose an action but cannot approve or execute
  it.
- Keep authentication, authorization, role checks, parameter restrictions, Control checks, and
  execution on the server.
- Bind the decision and idempotency key to the exact immutable proposal with a server-side binding
  secret.
- Keep exact parameters in caller-owned storage. Send only safe scalar signals and opaque
  references to Turnkeeper.
- Do not contact Replay synchronously in the customer-response path.
- Resume reviewed work explicitly and idempotently. Never treat a timeout or missing review as
  approval.

## Policy rules

- Use only supported operators: `always`, `exists`, `equals`, `in`, `gte`, and `lte`.
- Use only supported decisions: `allow`, `audit`, `review`, and `block`.
- Keep one condition per policy row.
- Add explicit fallback behavior for every risky action.
- Enforce roles and parameter restrictions in the application as well as the policy definition.
- Reject ambiguous equal-priority conflicts and unconditional high-risk allows.

## Failure handling

- On `block`, do not execute. Return a safe domain response and retain the decision reference.
- On `review`, persist pending state and return a resumable opaque reference.
- On `allow` or `audit`, execute only the exact persisted proposal and retain the outcome.
- On unavailable or malformed Control responses, fail closed for irreversible actions.
- On execution failure after approval, record failure against the same action binding.

## Reject insecure patterns

- Executing a tool before authorization and policy evaluation.
- Using prompt text as an approval mechanism.
- Performing authorization or role checks only in client code.
- Sending tool arguments, transcripts, PII, secrets, URLs, or provider payloads to Replay.
- Generating a new idempotency key for an exact retry.
- Treating `review`, timeout, `404`, `429`, or `503` as allow.
- Delivering Replay events with a detached promise or in-memory-only queue.
- Allowing a model to change parameters after approval.
