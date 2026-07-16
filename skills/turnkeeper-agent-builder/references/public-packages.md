# Public package reference

## `@turnkeeper/sdk`

Use the SDK in server-side runtime code.

Primary agent-governance exports include:

- `ControlClient`
- `createActionBinding`
- `deriveIdempotencyKey`
- `generatePolicy`
- `validatePolicy`
- `simulateAction`
- `generatePolicyTests`

Use `createActionBinding(action, bindingSecret)` only with a server-side secret, then pass the
result to `deriveIdempotencyKey(actionBinding)`. Pass the same secret to
`simulateAction(bundle, action, { bindingSecret })` for deterministic local cases. Never log or
return the binding secret.

The SDK also exposes `TurnkeeperClient` for metadata-only Replay ingestion and reads. Keep bearer
keys in server-side secret storage. Never import a configured client into browser code.

Use `simulateAction` for deterministic development and tests. Use `ControlClient` for a hosted
decision before a live side effect. A simulation result is not production authorization.

## `@turnkeeper/cli`

After publication, use the CLI for local development:

```sh
npx @turnkeeper/cli@0.1.0-alpha.1 init ./my-agent
npx @turnkeeper/cli@0.1.0-alpha.1 validate ./my-agent/turnkeeper/policies.json
npx @turnkeeper/cli@0.1.0-alpha.1 test-policies ./my-agent/turnkeeper/policies.json
```

Review generated files before use. The CLI must not execute refunds, bookings, account changes, or
other external actions.

## `@turnkeeper/mcp`

After publication, run the local stdio MCP server with:

```sh
TURNKEEPER_WORKSPACE_ROOT="$PWD" npx @turnkeeper/mcp@0.1.0-alpha.1
```

Use MCP tools to obtain quickstarts, scaffold code, generate or validate policies, simulate
actions, generate tests, inspect integrations, and obtain migration guidance. Keep MCP
development-only and do not pass production credentials, customer content, or exact action
parameters through tool inputs. Set `TURNKEEPER_WORKSPACE_ROOT` to the trusted project boundary;
inspection must not escape it.

Before publication, run the matching binaries through their npm workspaces after building the
monorepo.

## Version synchronization

Use the same prerelease version for the SDK, CLI, and MCP packages. When upgrading, read the root
changelog and rerun policy, package, example, and integration checks together.
